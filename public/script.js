let currentFile = null;
let translatedData = null;

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const langFromSelect = document.getElementById('langFrom');
const langToSelect = document.getElementById('langTo');
const translateBtn = document.getElementById('translateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const statusMsg = document.getElementById('statusMsg');
const resultContainer = document.getElementById('resultContainer');
const resultText = document.getElementById('resultText');

// Upload events
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.idml')) {
    selectFile(file);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectFile(file);
  }
});

function selectFile(file) {
  currentFile = file;
  fileName.textContent = `📄 ${file.name}`;
  fileName.classList.add('active');
}

// Translate
translateBtn.addEventListener('click', async () => {
  if (!currentFile) {
    alert('Please select an IDML file first');
    return;
  }

  const fromLang = langFromSelect.value;
  const toLang = langToSelect.value;

  if (fromLang === toLang) {
    alert('Source and target languages must be different');
    return;
  }

  translateBtn.disabled = true;
  progressContainer.style.display = 'block';
  resultContainer.style.display = 'none';

  try {
    statusMsg.textContent = 'Uploading and translating...';
    updateProgress(10);

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('fromLang', fromLang);
    formData.append('toLang', toLang);

    const response = await fetch('/api/translate', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Translation failed');
    }

    updateProgress(90);
    statusMsg.textContent = 'Finalizing...';

    translatedData = {
      downloadId: data.downloadId,
      fileName: data.fileName,
      textCount: data.textCount,
    };

    updateProgress(100);
    statusMsg.textContent = '✅ Complete!';
    resultText.textContent = `${data.textCount} texts translated successfully`;
    resultContainer.style.display = 'block';

  } catch (error) {
    console.error('Error:', error);
    statusMsg.textContent = `❌ Error: ${error.message}`;
    alert(`Error: ${error.message}`);
  } finally {
    translateBtn.disabled = false;
  }
});

// Download
downloadBtn.addEventListener('click', () => {
  if (!translatedData) {
    alert('No file to download');
    return;
  }

  const { downloadId, fileName } = translatedData;
  const url = `/api/download/${downloadId}?fileName=${encodeURIComponent(fileName)}`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

function updateProgress(percent) {
  progressFill.style.width = percent + '%';
  progressPercent.textContent = percent + '%';
}
