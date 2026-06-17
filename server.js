const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const JSZip = require('jszip');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.idml')) {
      cb(null, true);
    } else {
      cb(new Error('Only IDML files are allowed'), false);
    }
  },
});

const LANG_CODES = {
  'fr': 'fr',
  'en': 'en',
  'es': 'es',
  'de': 'de',
  'nl': 'nl',
  'pt': 'pt',
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function translateText(text, from, to) {
  if (!text || text.trim().length === 0) return text;
  
  try {
    const encodedText = encodeURIComponent(text.substring(0, 500));
    const from_code = LANG_CODES[from];
    const to_code = LANG_CODES[to];
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${from_code}|${to_code}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.responseData?.translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

// ========== Routes ==========

// Upload et traduction
app.post('/api/translate', upload.single('file'), async (req, res) => {
  try {
    const { fromLang, toLang } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    if (fromLang === toLang) {
      return res.status(400).json({ success: false, error: 'Source and target languages must be different' });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    // Extraire les textes
    const zip = new JSZip();
    await zip.loadAsync(fileBuffer);

    const stories = {};
    const allTexts = [];
    const textMap = {};

    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.startsWith('Stories/Story_') && filename.endsWith('.xml')) {
        const content = await file.async('string');
        const matches = content.match(/<Content>([^<]*)<\/Content>/g) || [];
        const texts = [];

        for (const match of matches) {
          const text = match.replace(/<Content>|<\/Content>/g, '');
          const trimmedText = text.trim();

          if (trimmedText.length > 0 && trimmedText.match(/[a-zA-Z0-9]/i)) {
            texts.push({ original: text, trimmed: trimmedText });
            if (!textMap[trimmedText]) {
              allTexts.push(trimmedText);
              textMap[trimmedText] = true;
            }
          }
        }
        stories[filename] = { content, texts };
      }
    }

    if (allTexts.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, error: 'No translatable text found' });
    }

    console.log(`Translating ${allTexts.length} texts from ${fromLang} to ${toLang}...`);

    // Traduire les textes
    const translations = {};
    for (let i = 0; i < allTexts.length; i++) {
      const text = allTexts[i];
      translations[text] = await translateText(text, fromLang, toLang);
      
      // Throttle les requêtes API
      if (i < allTexts.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Réinjecter les traductions
    const newZip = new JSZip();
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.startsWith('Stories/Story_') && filename.endsWith('.xml')) {
        const data = stories[filename];
        let content = data.content;

        for (const textObj of data.texts) {
          const translated = translations[textObj.trimmed];
          if (translated && translated !== textObj.trimmed) {
            const leadingSpace = textObj.original.match(/^ */)[0];
            const trailingSpace = textObj.original.match(/ *$/)[0];
            const withSpaces = leadingSpace + translated + trailingSpace;

            const original = textObj.original
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            const translatedEsc = withSpaces
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');

            const regex = new RegExp(`<Content>${escapeRegex(original)}<\\/Content>`, 'g');
            content = content.replace(regex, `<Content>${translatedEsc}</Content>`);
          }
        }

        newZip.file(filename, content);
      } else {
        const fileContent = await file.async('arraybuffer');
        newZip.file(filename, fileContent);
      }
    }

    const translatedBuffer = await newZip.generateAsync({ type: 'arraybuffer' });
    const downloadId = uuidv4();
    const downloadPath = path.join(uploadDir, `${downloadId}.idml`);
    fs.writeFileSync(downloadPath, translatedBuffer);

    // Nettoyer l'upload original après 5 secondes
    setTimeout(() => {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }, 5000);

    // Nettoyer le fichier téléchargé après 1 heure
    setTimeout(() => {
      try { fs.unlinkSync(downloadPath); } catch (e) {}
    }, 3600000);

    res.json({
      success: true,
      downloadId,
      fileName: req.file.originalname.replace('.idml', `_translated_${toLang.toUpperCase()}.idml`),
      textCount: allTexts.length,
    });

  } catch (error) {
    console.error('Error:', error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download fichier traduit
app.get('/api/download/:downloadId', (req, res) => {
  try {
    const filePath = path.join(uploadDir, `${req.params.downloadId}.idml`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found or expired' });
    }

    const fileName = req.query.fileName || 'translated.idml';
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Nettoyer le fichier après 30 secondes
    setTimeout(() => {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }, 30000);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🚀 Glossa Web Server running on http://localhost:${PORT}`);
});
