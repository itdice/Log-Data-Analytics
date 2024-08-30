import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, limit } from
        'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, openAiConfig } from "./security/secret.js";

const app = initializeApp(firebaseConfig);
const database = getFirestore(app);

const saveButton = document.body.querySelector("input#saveButton");
const kernelLogsContainer = document.body.querySelector("div#kernelLogs");
const allLogButton = document.body.querySelector("button#allLogsButton");
const recentLogButton = document.body.querySelector("button#recentLogsButton");
const summarizeContainer = document.body.querySelector("div#summarize");
const container = document.body.querySelector("div.container");

// 로그 데이터 파싱하기
const parseLogEntry = (filename, lawLogData) => {
    const logDataList = lawLogData.split(' ');
    if (logDataList.length < 6)
        return null;

    const parsedData = {
        filename: filename,
        timestamp: `${logDataList[0]} ${logDataList[1]} ${logDataList[2]}`,
        hostname: logDataList[3],
        log_level: logDataList[5].replace(':', ''),
        message: logDataList.slice(6).join(' ')
    };

    return parsedData;
}

// firestore에 저장하기
const saveLogToFirestore = async (parsedData) => {
    try {
        const docRef = await addDoc(collection(database, 'kernel_logs'), parsedData);
        console.log('Log entry added with ID: ', docRef.id);
    } catch (error) {
        console.error('Error adding log entry: ', error);
    }
};

// 업로드 관리 기능
const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const text = await file.text();
    const lines = text.split('\n');
    // 파일에서 로그 파싱
    const logs = lines.map(line => parseLogEntry(file.name, line)).filter(log => log !== null);
    for (const log of logs) {
        // firestore 에 저장
        await saveLogToFirestore(log);
    }
    console.log('All log entries have been uploaded.');
    alert('All log entries have been uploaded.');
};

// 업로드 관리 기능 이벤트 추가
saveButton.addEventListener('change', handleFileUpload);


// ==================================================================

// 로딩 이미지 만들기
const makeLoadImg = () => {
    const img = document.createElement('img');
    img.setAttribute('src', `./load.gif`);
    img.setAttribute('alt', 'Ai Summarizing...');
    img.setAttribute('width', '100px');
    img.setAttribute('height', '100px');

    return img;
}

// 로그 데이터 HTML에 저장하기
const logInsert = (doc) => {
    const log = doc.data();

    const logContainer = document.createElement('div');
    logContainer.classList.add('log-container');

    const filenameElement = document.createElement('div');
    filenameElement.classList.add('log-entry', 'filename');
    filenameElement.textContent = `${log.filename}`;

    const logElement = document.createElement('div');
    logElement.classList.add('log-entry', 'log');

    const logLevelElement = document.createElement('span');
    logLevelElement.classList.add(log.log_level.toLowerCase());
    logLevelElement.textContent = `${log.log_level}: ${log.message}`;

    logElement.appendChild(document.createTextNode(`[ ${log.timestamp} ] ${log.hostname} kernel: `));
    logElement.appendChild(logLevelElement);

    logContainer.appendChild(filenameElement);
    logContainer.appendChild(logElement);
    kernelLogsContainer.appendChild(logContainer);
}

// 로그 데이터를 line 데이터로 다시 바꿔주는 기능
const logDataToLine = (doc) => {
    const log = doc.data();
    const result = `${log.timestamp} ${log.hostname} kernel: ${log.log_level}: ${log.message}`;
    return result;
}

// firestore로부터 데이터를 가져오는 기능
const loadAllLogs = async () => {
    const q = query(collection(database, 'kernel_logs'), orderBy('timestamp'));
    const querySnapshot = await getDocs(q);
    kernelLogsContainer.innerHTML = ''; // 기존 로그 초기화
    querySnapshot.forEach((doc) => {
        logInsert(doc);
    });
    container.classList.add('invisible');
    summarizeContainer.textContent = "";
};

await loadAllLogs();

// 실시간 로그 업데이트 기능
const subscribeToRealTimeUpdates = () => {
    const q = query(collection(database, 'kernel_logs'), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        kernelLogsContainer.innerHTML = ''; // 기존 로그 초기화
        snapshot.forEach((doc) => {
            logInsert(doc);
        });
    });
};

subscribeToRealTimeUpdates();

// 최근 로그 10개만 가져오는 기능
const loadRecentLogs = async () => {
    const q = query(collection(database, 'kernel_logs'), orderBy('timestamp', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);

    kernelLogsContainer.innerHTML = ''; // 기존 로그 초기화
    querySnapshot.forEach((doc) => {
        logInsert(doc);
    });

    // ChatGPT 요약 기능 추가하기
    let logListData = [];  // line 형식으로 바꾼 로그를 저장하는 곳
    querySnapshot.forEach((doc) => {
        logListData.push(logDataToLine(doc));
    });

    if (logListData.length < 1) {
        alert("No log entries found.");
        return;
    }

    // 요약 칸 보이게 만들기
    container.classList.remove('invisible');
    summarizeContainer.appendChild(makeLoadImg());

    // 요약 정보 받아오기
    const summary = await summarizeLogs(logListData);
    if (summary === null) {
        alert("Failed to generate summary.");
        return;
    }

    summarizeContainer.textContent = "";

    summary.forEach((line) => {
        const summaryLineElement = document.createElement('div');
        summaryLineElement.classList.add('summary-line');
        summaryLineElement.textContent = line;
        summarizeContainer.appendChild(summaryLineElement);
    });
};

recentLogButton.addEventListener('click', async () => { await loadRecentLogs(); });
allLogButton.addEventListener('click', async () => { await loadAllLogs(); });


// ==================================================================

// ChatGPT에게 요약을 요청하는 기능
async function summarizeLogs(logs) {
    const requestData = {
        model: openAiConfig.model,
        messages: [
            {
                role: "system",
                content: `너는 로그 데이터를 읽고 분석해서 현재 상황을 요약해주는 로그 데이터 분석가야.
                          로그 데이터는 아래와 같은 예시로 주어질 거야.
                          
                          Aug 30 08:29:31 host08 kernel: FATAL: Booting Linux kernel ver
                          Aug 30 09:10:15 host12 kernel: ERROR: Failed to load module ext4
                          Aug 30 09:45:07 host02 kernel: WARNING: Low memory detected
                          Aug 30 10:23:19 host15 kernel: INFO: Network interface eth0 up
                          Aug 30 11:08:54 host20 kernel: DEBUG: Starting process ID 1234
                          
                          사용자에게 로그 데이터를 받아서 3줄 요약을 해줘.
                          물론 답변은 한국어로 부탁해.`
            },
            {
                role: "user",
                content: `여기 아래에 최근 10개의 로그 데이터를 보내줄게.
                          
                          ${logs.join('\n')}
                          
                          앞과 뒤에 첨언 없이 심플하게 로그를 분석해서 요약한 내용 3줄만 딱 출력해줘.
                          줄을 나눠서 사용할려고 하는데, 줄과 줄 사이에는 #을 추가해줘`
            }
        ],
        max_tokens: 500
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiConfig.apiKey}`
    };

    try {
        // ChatGPT에게 요청하기
        const response = await axios.post(openAiConfig.apiEndpoint, requestData, { headers });

        const summary = response.data.choices[0].message.content.trim();
        let summaryListData = summary.split('#');
        summaryListData = summaryListData.map((line) => line.trim());

        console.log('AI Summary: ', summaryListData);
        return summaryListData;
    }
    catch (error) {
        console.error('Error while summarizing logs: ', error);
        return null;
    }
}
