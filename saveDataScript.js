import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, limit } from
        'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from "./security/secret.js";

const app = initializeApp(firebaseConfig);
const database = getFirestore(app);

const saveButton = document.body.querySelector("input#saveButton");
const kernelLogsContainer = document.body.querySelector("div#kernelLogs");
const allLogButton = document.body.querySelector("button#allLogsButton");
const recentLogButton = document.body.querySelector("button#recentLogsButton");

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

// firestore로부터 데이터를 가져오는 기능
const loadAllLogs = async () => {
    const q = query(collection(database, 'kernel_logs'), orderBy('timestamp'));
    const querySnapshot = await getDocs(q);
    kernelLogsContainer.innerHTML = ''; // 기존 로그 초기화
    querySnapshot.forEach((doc) => {
        logInsert(doc);
    });
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
};

recentLogButton.addEventListener('click', async () => { await loadRecentLogs(); });
allLogButton.addEventListener('click', async () => { await loadAllLogs(); });

