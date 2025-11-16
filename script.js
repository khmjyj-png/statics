// 🔗 1) 여기 안에 "웹 앱 URL" 을 붙여 넣으세요.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxVILyjAxzbkyYhNF0cDEqw4ez5lRpAcFW4jRKP_WryVgdcvAgaECWFnsy4Kw-FryGSuA/exec";

// DOM 요소들 가져오기
const levelButtons = document.querySelectorAll(".level-btn");
const submitBtn = document.getElementById("submit-btn");
const avgDisplay = document.getElementById("avg");
const countDisplay = document.getElementById("count");
const thermoFill = document.getElementById("thermo-fill");
const statusText = document.getElementById("status-text");
const missionText = document.getElementById("mission-text");
const emotionLog = document.getElementById("emotion-log");

const studentSelect = document.getElementById("student-select");
const studentSummary = document.getElementById("student-summary");
const weeklyChart = document.getElementById("weekly-chart");

let selectedLevel = null;
let allData = []; // 전체 데이터를 여기 저장

// 2) 레벨 버튼 클릭 시 선택 표시
levelButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    levelButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedLevel = Number(btn.dataset.level);
  });
});

// 3) 제출 버튼 클릭 시 실행
submitBtn.addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const keywords = document.getElementById("keywords").value.trim();

  if (!selectedLevel) {
    alert("기분 점수(1~5)를 선택해주세요!");
    return;
  }

  const formData = new URLSearchParams();
  formData.append("name", name);
  formData.append("level", String(selectedLevel));
  formData.append("keywords", keywords);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.result === "success") {
      showToast("✅ 제출 완료!");
      document.getElementById("keywords").value = "";
      levelButtons.forEach((b) => b.classList.remove("selected"));
      selectedLevel = null;

      // 최신 데이터 다시 불러오기
      fetchAndDisplayData();
    } else {
      alert("저장 실패: " + (data.message || "알 수 없는 오류"));
    }
  } catch (err) {
    console.error(err);
    alert("통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }
});

// 4) 전체 데이터 불러와서 오늘/학생별/주간 모두 갱신
async function fetchAndDisplayData() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getAllData`);
    const data = await res.json();
    allData = data || [];

    updateTodayDisplay();
    updateStudentSelect();
    updateStudentStats();
    updateWeeklyChart();
  } catch (err) {
    console.error("데이터 로딩 오류:", err);
    statusText.textContent = "데이터를 불러오는 데 문제가 발생했습니다.";
  }
}

// 한국 시간(KST) 기준 'yyyy-mm-dd' 문자열 만들기
function toKstDateString(dateInput) {
  const d = new Date(dateInput);
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, "0");
  const day = String(kst.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 오늘 데이터 기준 온도계/로그 갱신
function updateTodayDisplay() {
  if (!allData || allData.length === 0) {
    countDisplay.textContent = "0";
    avgDisplay.textContent = "0.0";
    thermoFill.style.height = "0%";
    statusText.textContent = "아직 오늘 기록이 없습니다.";
    missionText.textContent = "오늘의 첫 체크인을 남겨보세요!";
    emotionLog.innerHTML = "";
    return;
  }

  const todayStr = toKstDateString(new Date());
  const todaysData = allData.filter(
    (entry) => toKstDateString(entry.timestamp) === todayStr
  );

  if (todaysData.length === 0) {
    countDisplay.textContent = "0";
    avgDisplay.textContent = "0.0";
    thermoFill.style.height = "0%";
    statusText.textContent = "아직 오늘 기록이 없습니다.";
    missionText.textContent = "오늘의 첫 체크인을 남겨보세요!";
    emotionLog.innerHTML = "";
    return;
  }

  const count = todaysData.length;
  const totalLevel = todaysData.reduce(
    (sum, entry) => sum + Number(entry.level || 0),
    0
  );
  const avg = totalLevel / count;

  countDisplay.textContent = String(count);
  avgDisplay.textContent = avg.toFixed(1);

  // 1~5 점수를 0~100%로 변환 (1점 = 0%, 5점 = 100%)
  const fillPercent = ((avg - 1) / 4) * 100;
  const clamped = Math.max(0, Math.min(100, fillPercent));
  thermoFill.style.height = `${clamped}%`;

  // 평균에 따른 상태 문구
  let statusMsg = `오늘 ${count}명이 참여했어요. 평균 ${avg.toFixed(1)}점`;
  let missionMsg = "";

  if (avg >= 4) {
    statusMsg += " 😊 분위기가 아주 좋네요!";
    missionMsg = "✨ 미션: 옆 친구에게 칭찬 한 마디 건네보기";
  } else if (avg >= 2.5) {
    statusMsg += " 🙂 무난한 하루예요.";
    missionMsg = "🤝 미션: 오늘 나에게 고마웠던 일 한 가지 떠올려보기";
  } else {
    statusMsg += " 🫤 오늘 컨디션이 조금 내려가 있네요.";
    missionMsg = "🙏 미션: 깊게 숨 들이쉬고 10초 동안 눈을 감고 쉬어보기";
  }

  statusText.textContent = statusMsg;
  missionText.textContent = missionMsg;

  // 최근 5개의 오늘 응답만 로그에 표시 (최신이 위로 오게)
  const latest5 = todaysData.slice(-5).reverse();
  emotionLog.innerHTML = latest5
    .map((entry) => {
      const timeStr = new Date(entry.timestamp).toLocaleTimeString("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
      });
      const name = entry.name || "익명";
      const level = entry.level || "?";
      const keywords = entry.keywords || "";
      return `<li>[${timeStr}] ${name}: ${level}점${
        keywords ? ` (키워드: ${keywords})` : ""
      }</li>`;
    })
    .join("");
}

// 학생 선택 드롭다운 채우기
function updateStudentSelect() {
  if (!allData || allData.length === 0) return;

  const names = Array.from(
    new Set(
      allData
        .map((d) => (d.name || "").trim())
        .filter((n) => n !== "")
    )
  ).sort();

  // 기본 옵션 하나 남기고 나머지 초기화
  studentSelect.innerHTML = '<option value="">전체 학생</option>';

  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    studentSelect.appendChild(opt);
  });
}

// 선택된 학생의 누적 통계
function updateStudentStats() {
  if (!allData || allData.length === 0) {
    studentSummary.textContent = "아직 기록이 없습니다.";
    return;
  }

  const selectedName = studentSelect.value; // "" 이면 전체

  let targetData = allData;
  if (selectedName) {
    targetData = allData.filter((d) => (d.name || "").trim() === selectedName);
  }

  if (targetData.length === 0) {
    studentSummary.textContent = selectedName
      ? `${selectedName} 학생의 기록이 아직 없습니다.`
      : "기록이 없습니다.";
    return;
  }

  const count = targetData.length;
  const totalLevel = targetData.reduce(
    (sum, d) => sum + Number(d.level || 0),
    0
  );
  const avg = totalLevel / count;
  const min = Math.min(...targetData.map((d) => Number(d.level || 0)));
  const max = Math.max(...targetData.map((d) => Number(d.level || 0)));

  const firstDate = toKstDateString(targetData[0].timestamp);
  const lastDate = toKstDateString(
    targetData[targetData.length - 1].timestamp
  );

  studentSummary.innerHTML = `
    <p><strong>${selectedName || "전체 학생"}</strong> 기준 통계</p>
    <p>✅ 총 응답 수: <strong>${count}</strong>회</p>
    <p>😊 평균 기분: <strong>${avg.toFixed(2)}</strong>점 (최저 ${min}점, 최고 ${max}점)</p>
    <p>📅 기록 기간: ${firstDate} ~ ${lastDate}</p>
  `;
}

// 최근 7일 평균 그래프
function updateWeeklyChart() {
  weeklyChart.innerHTML = "";
  if (!allData || allData.length === 0) {
    weeklyChart.textContent = "아직 기록이 없습니다.";
    return;
  }

  const today = new Date();
  const days = [];

  // 최근 7일 (6일 전 ~ 오늘)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toKstDateString(d);
    days.push({ date: d, dateStr });
  }

  const dataByDate = {};
  allData.forEach((entry) => {
    const ds = toKstDateString(entry.timestamp);
    if (!dataByDate[ds]) dataByDate[ds] = [];
    dataByDate[ds].push(Number(entry.level || 0));
  });

  days.forEach(({ date, dateStr }) => {
    const arr = dataByDate[dateStr] || [];
    let avg = 0;
    if (arr.length > 0) {
      avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    }

    const bar = document.createElement("div");
    bar.className = "weekly-bar";

    const rect = document.createElement("div");
    rect.className = "weekly-bar-rect";

    // 1~5를 0~100%로
    const percent = arr.length > 0 ? ((avg - 1) / 4) * 100 : 0;
    const clamped = Math.max(0, Math.min(100, percent));
    rect.style.height = `${clamped}%`;

    const label = document.createElement("div");
    label.className = "weekly-bar-label";
    const day = date.toLocaleDateString("ko-KR", {
      weekday: "short",
    });
    label.textContent = `${day}\n${arr.length > 0 ? avg.toFixed(1) : "-"}`;

    bar.appendChild(rect);
    bar.appendChild(label);
    weeklyChart.appendChild(bar);
  });
}

// 학생 선택 변경 시 통계 업데이트
studentSelect.addEventListener("change", updateStudentStats);

// 토스트 메시지
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// 페이지 처음 열릴 때 전체 데이터 한 번 불러오기
fetchAndDisplayData();
