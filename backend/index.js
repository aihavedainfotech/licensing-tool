require('dotenv').config()

const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { v4: uuidv4 } = require('uuid')
const XLSX = require('xlsx')
const multer = require('multer')
const { PDFParse } = require('pdf-parse')
const { GoogleGenAI } = require('@google/genai');
const { executeOracleRoleRemediation, executeHierarchyRemediation, getJobStatus, getAllJobs } = require('./services/oracleSecurityRpa');

const genAI = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID || 'project-b7e4de28-72cd-4ca3-92a',
  location: 'us-central1',
});

async function generateAIContent(selectedModel, systemPrompt, userPrompt, temperature, isJson) {
  if (selectedModel.startsWith('gemini')) {
    const resp = await genAI.models.generateContent({
      model: selectedModel,
      contents: userPrompt || 'Proceed.',
      config: {
        temperature,
        responseMimeType: isJson ? "application/json" : "text/plain",
        systemInstruction: systemPrompt,
      }
    });
    const content = resp.text;

    // Parse usage
    const usageMetadata = resp.usageMetadata || {};
    return {
      content,
      usage: {
        prompt_tokens: usageMetadata.promptTokenCount || 0,
        completion_tokens: usageMetadata.candidatesTokenCount || 0,
        total_tokens: usageMetadata.totalTokenCount || 0,
      }
    };
  } else {
    // DeepSeek
    const messages = [{ role: 'system', content: systemPrompt }];
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature,
        response_format: isJson ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API Error: ${errText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage
    };
  }
}
// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() })

/* Ã¢â€â‚¬Ã¢â€â‚¬ Validate required env vars on startup Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const REQUIRED = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET_NAME']
const missing = REQUIRED.filter(k => !process.env[k])
if (missing.length) {
  console.error('Ã¢ÂÅ’  Missing required environment variables:', missing.join(', '))
  console.error('    Copy server/.env.example Ã¢â€ â€™ server/.env and fill in your values.')
  process.exit(1)
}

const PORT = process.env.PORT || 3001
const BUCKET = process.env.S3_BUCKET_NAME
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const CONFIG_S3_KEY = 'config/oracle_fusion_services_privileges.json'

/* Ã¢â€â‚¬Ã¢â€â‚¬ AWS S3 client Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
})

/* ── High-Performance In-Memory Buffer & Config Caches ────────────────────── */
const uploadedBuffersCache = new Map();

function cacheUploadedBuffer(key, buffer) {
  uploadedBuffersCache.set(key, { buffer, timestamp: Date.now() });
  // Keep up to 30 recent files, prune expired (> 45 mins)
  const now = Date.now();
  for (const [k, v] of uploadedBuffersCache.entries()) {
    if (now - v.timestamp > 45 * 60 * 1000) uploadedBuffersCache.delete(k);
  }
}

function getCachedBuffer(key) {
  if (!key) return null;
  const item = uploadedBuffersCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > 45 * 60 * 1000) {
    uploadedBuffersCache.delete(key);
    return null;
  }
  return item.buffer;
}

let cachedPrivilegesConfig = null;
let cachedCostSheetData = null;

async function getCostSheetData() {
  if (cachedCostSheetData && Array.isArray(cachedCostSheetData)) return cachedCostSheetData;
  try {
    const buf = await s3ToBuffer('config/global_cost_sheet_data.json');
    cachedCostSheetData = JSON.parse(buf.toString('utf-8'));
    console.log(`✅ Loaded global cost sheet data: ${cachedCostSheetData.length} prices`);
    return cachedCostSheetData;
  } catch (e) {
    console.log('⚠️ No global cost sheet data found. Proceeding without costs.');
    return [];
  }
}

async function getPrivilegesConfig() {
  if (cachedPrivilegesConfig && Array.isArray(cachedPrivilegesConfig)) return cachedPrivilegesConfig;
  try {
    console.log(`⚙️    Fetching config from S3: ${CONFIG_S3_KEY}`);
    const buf = await s3ToBuffer(CONFIG_S3_KEY);
    const parsedConfig = JSON.parse(buf.toString('utf-8'));
    cachedPrivilegesConfig = parsedConfig.services || parsedConfig;
    return cachedPrivilegesConfig;
  } catch (err) {
    console.warn(`⚠️    Config not found in S3 or error reading it:`, err.message);
    return [];
  }
}

async function getBuffer(key) {
  if (!key) return null;
  const fast = getCachedBuffer(key);
  if (fast) {
    console.log(`⚡ [Fast Buffer Cache] Instant 0ms load for: ${key}`);
    return fast;
  }
  console.log(`📥 [S3 Fetch] Downloading from S3: ${key}`);
  const buf = await s3ToBuffer(key);
  cacheUploadedBuffer(key, buf);
  return buf;
}


/* Ã¢â€â‚¬Ã¢â€â‚¬ Express app Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5175',
  ORIGIN,
]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, ORIGIN)
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
}))
app.options('*', cors())

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use('/proofs', express.static(path.join(__dirname, 'public', 'proofs')))

/* ── Document Upload Multer Configuration ─────────────────────────────────── */
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const allowedExts = ['.xlsx', '.xls', '.pdf', '.csv', '.docx']
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ]

    if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type "${file.mimetype || ext}" is not allowed. Supported formats: ${allowedExts.join(', ')}`))
    }
  },
})

/* ── Health check ───────────────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', bucket: BUCKET, region: process.env.AWS_REGION })
})

/* ── POST /api/upload
     Multipart form data:  file: File
     Uploads document to S3 bucket (uploads/<uuid>_<filename>)
     Returns: { success: true, s3Key: string, filename: string, size: number, mimetype: string }
─────────────────────────────────────────────────────────────────────────── */
app.post('/api/upload', (req, res, next) => {
  documentUpload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.warn(`⚠️  [Upload] Multer error: ${err.code} - ${err.message}`)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 100MB.' })
      }
      return res.status(400).json({ error: `File upload error: ${err.message}` })
    } else if (err) {
      console.warn(`⚠️  [Upload] Validation error: ${err.message}`)
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}, async (req, res) => {
  try {
    if (!req.file) {
      console.warn('⚠️  [Upload] No file attached in request')
      return res.status(400).json({ error: 'No file uploaded. Please select a file.' })
    }

    const originalName = req.file.originalname || 'document.bin'
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const s3Key = `uploads/${uuidv4()}_${safeName}`

    // Infer content type if octet-stream or missing
    let contentType = req.file.mimetype
    if (!contentType || contentType === 'application/octet-stream') {
      const ext = path.extname(originalName).toLowerCase()
      const mimeMap = {
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.pdf': 'application/pdf',
        '.csv': 'text/csv',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      contentType = mimeMap[ext] || 'application/octet-stream'
    }

    console.log(`📤 [Upload] Uploading "${originalName}" (${req.file.size} bytes, ${contentType}) to S3: ${s3Key}`)

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: contentType,
    })

    await s3.send(command)
    cacheUploadedBuffer(s3Key, req.file.buffer)

    console.log(`✅ [Upload] Successfully saved to S3 bucket "${BUCKET}": ${s3Key}`)
    return res.status(200).json({
      success: true,
      message: 'File successfully uploaded and stored in S3.',
      s3Key,
      filename: originalName,
      size: req.file.size,
      mimetype: contentType,
    })
  } catch (err) {
    console.error('❌ [Upload] Failed to upload document to S3:', err)
    return res.status(500).json({
      error: `Failed to upload document to S3: ${err.message || 'Unknown server error'}`,
    })
  }
})

app.post('/api/presigned-url', async (req, res) => {
  try {
    const { filename, contentType } = req.body

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' })
    }

    // Validate allowed types
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.ms-excel',
      'application/json',
    ]
    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: `File type "${contentType}" is not allowed.` })
    }

    // Build a unique S3 key:  uploads/<uuid>_<original-filename>
    const ext = filename.includes('.') ? filename.split('.').pop() : 'bin'
    const s3Key = `uploads/${uuidv4()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: contentType,
    })

    // Presigned URL valid for 10 minutes
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 })

    console.log(`Ã¢Å“â€¦  Presigned URL issued for: ${s3Key}`)
    return res.json({ uploadUrl, s3Key })

  } catch (err) {
    console.error('Error generating presigned URL:', err)
    return res.status(500).json({ error: 'Failed to generate upload URL. Check server logs.' })
  }
})

/* ---------------------------------- DELETE /api/file
     Body:  { s3Key: string }
     Deletes a file from S3 (called when user clicks "Remove")
------------------------------------------------------------------------------------------------------------------------- */
app.delete('/api/file', async (req, res) => {
  try {
    const { s3Key } = req.body
    if (!s3Key) return res.status(400).json({ error: 's3Key is required' })

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }))
    console.log(`🗑️   Deleted from S3: ${s3Key}`)
    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting file:', err)
    return res.status(500).json({ error: 'Failed to delete file.' })
  }
})

/* Ã¢â€â‚¬Ã¢â€â‚¬ In-memory result cache Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const ANALYSIS_CACHE_FILE = path.join(__dirname, 'config/analysis_results_cache.json');
let cachedResult = null;
try {
  if (fs.existsSync(ANALYSIS_CACHE_FILE)) {
    cachedResult = JSON.parse(fs.readFileSync(ANALYSIS_CACHE_FILE, 'utf8'));
    console.log(`✅ Loaded cached analysis result from disk: ${cachedResult.services?.length || 0} services, ${cachedResult.totalLicences || 0} licences`);
  }
} catch (e) {
  console.warn('Could not load analysis_results_cache.json:', e.message);
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Helper: stream S3 object to Buffer Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
async function s3ToBuffer(s3Key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key })
  const resp = await s3.send(cmd)
  const chunks = []
  for await (const chunk of resp.Body) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Helper: pick newest XLSX from uploads/ Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
async function findLatestXlsx() {
  const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'uploads/' }))
  const files = (list.Contents || []).filter(o => o.Key.endsWith('.xlsx') || o.Key.endsWith('.csv'))
  if (!files.length) return null
  files.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
  return files[0].Key
}

/* Ã¢â€ â‚¬Ã¢â€ â‚¬ Licence engine Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬ */
//  Input rows: [{ SERVICE, USER_LOGIN, PRIVILEGE_NAME, ROLE_NAME, ROLE_CODE }]
//  Input costConfig: Parsed JSON array/object containing costed privileges per service
//  Rules:
//   - Only privileges listed in the JSON config consume a licence.
//   - One employee with N costed privileges from the SAME service = 1 licence.
//   - Output: hierarchy SERVICE → PRIVILEGE_NAME → ROLE_NAME → employees[]
function buildHierarchy(rows, costConfig, costData = [], subscribedQuantityMap = new Map(), activeStatusMap = new Map()) {
  // Build a fast lookup for costed privileges from the JSON config
  // Assumes JSON structure: [{ service_name: "...", privileges: ["Priv A", "Priv B"] }]
  // Create a reverse mapping from Privilege -> Array<Service Name>
  const privToServices = new Map()
  if (Array.isArray(costConfig)) {
    for (const item of costConfig) {
      const sName = (item.service_name || item.serviceName || item.SERVICE || '').trim()
      const privs = Array.isArray(item.privileges) ? item.privileges : (item.PRIVILEGES || [])
      if (sName && privs.length > 0) {
        for (const p of privs) {
          let pName = '';
          if (typeof p === 'string') pName = p.trim();
          else if (typeof p === 'object' && p.privilege) pName = p.privilege.trim();

          if (pName) {
            if (!privToServices.has(pName)) privToServices.set(pName, new Set());
            privToServices.get(pName).add(sName);
          }
        }
      }
    }
  }

  // Service colour palette
  const PALETTE = [
    { color: '#1d6fa4', bg: 'linear-gradient(135deg,#eff8ff,#dbeafe)' },
    { color: '#059669', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
    { color: '#7c3aed', bg: 'linear-gradient(135deg,#faf5ff,#ede9fe)' },
    { color: '#d97706', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)' },
    { color: '#0891b2', bg: 'linear-gradient(135deg,#ecfeff,#cffafe)' },
    { color: '#dc2626', bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)' },
    { color: '#db2777', bg: 'linear-gradient(135deg,#fdf2f8,#fce7f3)' },
  ]

  // Expand rows based on matched privileges
  const validRows = []
  for (const row of rows) {
    const priv = (row.PRIVILEGE || row.PRIVILEGE_NAME || '').trim()

    // Check if we have this privilege in our costed config
    if (priv && privToServices.has(priv)) {
      const services = Array.from(privToServices.get(priv))
      for (const svc of services) {
        validRows.push({ ...row, SERVICE: svc, PRIVILEGE: priv })
      }
    }
  }

  // Step 1: Build nested maps  SERVICE -> PRIVILEGE_NAME -> ROLE_NAME -> Set<USER_LOGIN>
  const svcMap = new Map()

  for (const row of validRows) {
    const svc = (row.SERVICE || '').trim()
    const user = (row.USER_LOGIN || '').trim()
    const priv = (row.PRIVILEGE || row.PRIVILEGE_NAME || '').trim()
    const role = (row.ROLE_NAME || '').trim()
    if (!svc || !user || !priv) continue

    if (!svcMap.has(svc)) svcMap.set(svc, new Map())
    const privMap = svcMap.get(svc)
    if (!privMap.has(priv)) privMap.set(priv, new Map())
    const roleMap = privMap.get(priv)
    if (!roleMap.has(role)) roleMap.set(role, new Set())
    roleMap.get(role).add(user)
  }

  // Step 2: Licence count per service = unique users mapped to the service (across ALL validRows)
  const svcUserMap = new Map()
  for (const row of validRows) {
    const svc = (row.SERVICE || '').trim()
    const user = (row.USER_LOGIN || '').trim()
    const role = (row.ROLE_NAME || '').trim()
    if (!svc || !user) continue

    let isActive = true;
    if (activeStatusMap.size > 0) {
      const normalizedRole = role.toLowerCase().replace(/_/g, ' ');
      const key = `${user.toLowerCase()}|${normalizedRole}`;
      if (activeStatusMap.has(key)) {
        isActive = activeStatusMap.get(key);
      }
    }
    if (!isActive) continue;

    if (!svcUserMap.has(svc)) svcUserMap.set(svc, new Set())
    svcUserMap.get(svc).add(user)
  }

  // Also preserve SKUs from original rows for fallback mapping
  const svcToSku = new Map()
  const knownServices = new Set()
  if (Array.isArray(costConfig)) {
    for (const item of costConfig) {
      const sName = (item.service_name || item.serviceName || item.SERVICE || '').trim()
      if (sName) knownServices.add(sName)
    }
  }

  // Fast SKU mapping: only inspect unique service names in dataset
  const uniqueSvcSkuPairs = new Map()
  for (const row of rows) {
    const svcRaw = (row.SERVICE || row['Service Name'] || '').trim()
    const sku = (row.SKU || '').trim()
    if (svcRaw && sku && !uniqueSvcSkuPairs.has(svcRaw)) {
      uniqueSvcSkuPairs.set(svcRaw, sku)
    }
  }
  for (const [svcRaw, sku] of uniqueSvcSkuPairs) {
    for (const knownSvc of knownServices) {
      if (svcRaw === knownSvc || svcRaw.includes(knownSvc) || knownSvc.includes(svcRaw)) {
        svcToSku.set(knownSvc, sku)
      }
    }
  }

  // Step 3: Build output
  const services = []
  let paletteIdx = 0

  for (const [svcName, privMap] of svcMap) {
    const palette = PALETTE[paletteIdx % PALETTE.length]
    paletteIdx++

    const privileges = []
    for (const [privName, roleMap] of privMap) {
      const roles = []
      for (const [roleName, userSet] of roleMap) {
        const employees = [...userSet].map((login, i) => {
          let status = 'active';
          const normalizedRole = roleName.trim().toLowerCase().replace(/_/g, ' ');
          const key = `${login.toLowerCase()}|${normalizedRole}`;
          if (activeStatusMap.has(key)) {
            status = activeStatusMap.get(key) ? 'active' : 'inactive';
          }
          return {
            id: login,
            name: login,
            email: `${login.toLowerCase()}@corp.com`,
            department: '',
            status,
            avatar: login.slice(0, 2).toUpperCase(),
          };
        })
        roles.push({
          id: `${svcName}|${privName}|${roleName}`,
          name: roleName || '(No Role)',
          employeeCount: employees.length,
          licenseUsed: employees.length,
          licenseTotal: employees.length,
          employees,
        })
      }

      const privUserSet = new Set()
      for (const r of roles) {
        for (const emp of r.employees) privUserSet.add(emp.id)
      }
      const totalUsersForPriv = privUserSet.size
      privileges.push({
        id: `${svcName}|${privName}`,
        name: privName,
        description: `${privName} - ${totalUsersForPriv} user${totalUsersForPriv !== 1 ? 's' : ''}`,
        costPerUser: 0,
        totalCost: 0,
        usageCount: totalUsersForPriv,
        usageLimit: 0,
        risk: 'medium',
        roles,
      })
    }

    const licenseCount = (svcUserMap.get(svcName) || new Set()).size
    const sku = svcToSku.get(svcName) || ''

    let unitCost = 0;
    let finalSku = sku;
    let minQty = 1;
    let metric = '';

    if (Array.isArray(costData)) {
      for (const cd of costData) {
        // More forgiving name matching logic
        const sNameLower = svcName.toLowerCase();
        const cdNameLower = (cd.serviceName || '').toLowerCase();

        if (
          (cdNameLower && (sNameLower === cdNameLower || sNameLower.includes(cdNameLower) || cdNameLower.includes(sNameLower))) ||
          (cd.partNumber && sku && cd.partNumber === sku)
        ) {
          unitCost = parseFloat(cd.cost) || 0;
          if (cd.partNumber) finalSku = cd.partNumber;
          if (cd.minimumQuantity) minQty = parseInt(cd.minimumQuantity, 10) || 1;
          if (cd.metric) metric = cd.metric;
          break;
        }
      }
    }

    if (minQty < 1) minQty = 1;

    if (subscribedQuantityMap.size > 0) {
      if (!subscribedQuantityMap.has(finalSku)) {
        continue;
      }
    } else {
      if (unitCost === 0) {
        continue;
      }
    }

    const billingUnits = licenseCount > 0 ? Math.ceil(licenseCount / minQty) : 0;
    const billableQuantity = billingUnits * minQty;
    const totalCost = billingUnits * unitCost;

    const subscribedQuantity = subscribedQuantityMap.has(finalSku) ? subscribedQuantityMap.get(finalSku) : undefined;
    const overProvisioned = subscribedQuantity !== undefined ? Math.max(0, billableQuantity - subscribedQuantity) : 0;

    // Calculate the actual cost of the over-provisioned units
    const overageBillingUnits = overProvisioned > 0 ? Math.ceil(overProvisioned / minQty) : 0;
    const overageCost = overageBillingUnits * unitCost;

    services.push({
      id: svcName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
      name: svcName,
      sku: finalSku,
      vendor: '',
      icon: '🏢',
      color: palette.color,
      bgGradient: palette.bg,
      totalCost: totalCost,
      licenseCount,
      billableQuantity,
      billingUnits,
      minimumQuantity: minQty,
      metric,
      unitCost,
      overageCost,
      privilegeCount: privileges.length,
      overProvisioned: overProvisioned,
      subscribedQuantity,
      privileges,
    })
  }

  services.sort((a, b) => b.licenseCount - a.licenseCount)

  return {
    processedAt: new Date().toISOString(),
    totalLicences: services.reduce((a, s) => a + s.licenseCount, 0),
    services,
  }
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ POST /api/process
/* âŽ¯âŽ¯ POST /api/process
     Body: { s3Key: string }
     Downloads XLSX from S3, runs licence engine, caches result.
âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯ */
app.post('/api/process', async (req, res) => {
  const startTime = Date.now();
  try {
    const s3Key = req.body.xlsxS3Key || req.body.s3Key;
    const summaryS3Key = req.body.summaryS3Key;
    const statusS3Key = req.body.statusS3Key;

    if (!s3Key) {
      return res.status(400).json({ error: 'xlsxS3Key is required for analysis' });
    }

    console.log(`🚀 [Analysis Engine] Starting analysis for main sheet: ${s3Key}`);

    // ⚡ 1. Parallel Fetch: Fetch all buffers and configs concurrently in ONE parallel round-trip
    const [costSheetData, privilegesConfig, summaryBuf, statusBuf, mainBuf] = await Promise.all([
      getCostSheetData(),
      getPrivilegesConfig(),
      summaryS3Key ? getBuffer(summaryS3Key).catch(e => { console.warn('Could not load summary sheet:', e.message); return null; }) : Promise.resolve(null),
      statusS3Key ? getBuffer(statusS3Key).catch(e => { console.warn('Could not load status sheet:', e.message); return null; }) : Promise.resolve(null),
      getBuffer(s3Key),
    ]);

    const fetchDuration = Date.now() - startTime;
    console.log(`⏱️ [Analysis Engine] Document retrieval completed in ${fetchDuration}ms`);

    // ⚡ 2. Fast Processing: Summary Sheet
    const subscribedQuantityMap = new Map();
    if (summaryBuf) {
      try {
        const summaryWb = XLSX.read(summaryBuf, { type: 'buffer', dense: true, cellFormula: false, cellHTML: false, cellStyles: false, cellDates: false });
        const summarySheetName = summaryWb.SheetNames.includes('Sheet1') ? 'Sheet1' : summaryWb.SheetNames[0];
        const summaryRows = XLSX.utils.sheet_to_json(summaryWb.Sheets[summarySheetName], { header: 1 });

        for (const row of summaryRows) {
          if (Array.isArray(row) && row.length >= 7) {
            let partNumber = typeof row[1] === 'string' ? row[1] : '';
            if (partNumber) {
              partNumber = partNumber.replace(/^>\s*/, '').trim();
              const subscribedQty = parseInt(row[6], 10);
              if (!isNaN(subscribedQty)) {
                subscribedQuantityMap.set(partNumber, subscribedQty);
              }
            }
          }
        }
        console.log(`✅ Extracted ${subscribedQuantityMap.size} subscribed quantities from Summary Sheet`);
      } catch (err) {
        console.warn(`⚠️ Error processing Summary Sheet:`, err.message);
      }
    }

    // ⚡ 3. Fast Processing: User Active Status Sheet
    const activeStatusMap = new Map();
    if (statusBuf) {
      try {
        const statusWb = XLSX.read(statusBuf, { type: 'buffer', dense: true, cellFormula: false, cellHTML: false, cellStyles: false, cellDates: false });
        const statusSheetName = statusWb.SheetNames.includes('Sheet1') ? 'Sheet1' : statusWb.SheetNames[0];
        const statusRows = XLSX.utils.sheet_to_json(statusWb.Sheets[statusSheetName], { defval: '' });

        for (const row of statusRows) {
          if (row['User Name']) {
            const normalizedRole = (row['Role Name'] || '').trim().toLowerCase().replace(/_/g, ' ');
            const key = `${row['User Name'].toLowerCase()}|${normalizedRole}`;
            const isActive = row['User Suspended'] === 'No';
            activeStatusMap.set(key, isActive);
          }
        }
        console.log(`✅ Extracted ${activeStatusMap.size} statuses from User Status Sheet`);
      } catch (err) {
        console.warn(`⚠️ Error processing User Status Sheet:`, err.message);
      }
    }

    // ⚡ 4. Fast Processing: Users & Roles Document
    console.log(`⚙️  Parsing Users & Roles workbook (dense mode)...`);
    const wb = XLSX.read(mainBuf, { type: 'buffer', dense: true, cellFormula: false, cellHTML: false, cellStyles: false, cellDates: false });
    const sheetName = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    console.log(`   Parsed ${rows.length} rows from sheet "${sheetName}"`);

    // ⚡ 5. Build Hierarchy
    cachedResult = buildHierarchy(rows, privilegesConfig, costSheetData, subscribedQuantityMap, activeStatusMap);
    const totalDuration = Date.now() - startTime;
    console.log(`✅  [Analysis Engine] Completed in ${totalDuration}ms: ${cachedResult.services.length} services, ${cachedResult.totalLicences} licences`);

    // Non-blocking background disk cache write
    fs.writeFile(ANALYSIS_CACHE_FILE, JSON.stringify(cachedResult), (err) => {
      if (err) console.warn('Could not persist analysis_results_cache.json in background:', err.message);
    });

    return res.json({ ok: true, services: cachedResult.services.length, totalLicences: cachedResult.totalLicences, durationMs: totalDuration })
  } catch (err) {
    console.error('Error processing file:', err)
    return res.status(500).json({ error: err.message })
  }
})

/* âŽ¯âŽ¯ GET /api/analysis-results âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯âŽ¯ */
app.get('/api/analysis-results', async (_req, res) => {
  if (cachedResult) return res.json(cachedResult)
  return res.status(404).json({ error: 'No analysis available. Please upload your XLSX usage report and click Analyse.' })
})

/* ── POST /api/ai-insight ────────────────────────────────────────────────────────── */
app.post('/api/ai-insight', async (req, res) => {
  try {
    const { privilegeName, serviceName, model } = req.body;
    if (!privilegeName) return res.status(400).json({ error: 'privilegeName is required' });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    // Normalize model name: frontend may send 'deepseek' but API needs 'deepseek-chat'
    const selectedModel = (!model || model === 'deepseek') ? 'deepseek-chat' : model;

    const systemPrompt = `You are an Oracle Fusion Cloud Licensing Expert.
The user is inquiring about the privilege: "${privilegeName}"${serviceName ? ` under the service "${serviceName}"` : ''}.

Provide the response in two distinct methods inside a strictly formatted JSON object with these exact keys:

[For Method 1 - Detailed 2-3 Line Narrative]:
- "explanation": A concise 2 to 3 sentence explanation of what this privilege is and what core business functionality it provides (MUST BE A STRING).
- "alternative": A concise 1 to 2 sentence recommendation of a free or lower-cost alternative privilege or duty role (MUST BE A STRING).

[For Method 2 - Structured Direct Mapping]:
- "costedPrivilege": "${privilegeName}" (The current privilege being analyzed, MUST BE A STRING).
- "costedPrivilegeCosted": "Yes" (The current privilege requires a paid license).
- "alternatePrivilege": The exact name or duty role code of the suggested alternative privilege or duty role (e.g. "HWM_TIME_CARD_ENTRY_DUTY" or "None", MUST BE A STRING).
- "alternatePrivilegeCosted": "No" (The suggested alternative is free or incurs no extra license fee).
- "impact": The specific functional impact on the user if replaced. CRITICAL: If the impact is merely a generic or obvious statement (such as "The user will lose access to this feature" or "Users cannot perform this task"), return an empty string "" instead. Only output text if there is a concrete, valuable functional distinction or edge case to highlight.

Output ONLY valid JSON where EVERY value is a simple string without any markdown code fences.`;

    const aiResp = await generateAIContent(selectedModel, systemPrompt, null, 0.2, true);
    const parsed = JSON.parse(aiResp.content);

    // Normalize fields for clarity
    parsed.costedPrivilege = parsed.costedPrivilege || parsed.privilegeName || privilegeName;
    parsed.costedPrivilegeCosted = 'Yes';
    parsed.alternatePrivilege = parsed.alternatePrivilege || parsed.alternativeName || 'None';
    parsed.alternatePrivilegeCosted = parsed.alternatePrivilegeCosted || 'No';
    parsed.costed = 'Yes';
    parsed.isCostedMessage = 'Costed: Yes (Paid License)';

    if (parsed.impact && (
      parsed.impact.toLowerCase().includes('will lose access to this feature') ||
      parsed.impact.toLowerCase().includes('cannot perform this task') ||
      parsed.impact.trim().length < 15
    )) {
      parsed.impact = '';
    }

    // Include token usage
    parsed.usage = aiResp.usage;

    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
})

/* ── CONFIGURATION ENDPOINTS (Oracle Privileges) ────────────────────────────── */

const extractionJobs = new Map();

app.post('/api/settings/privileges/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Uploaded file must be a PDF' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const selectedModel = req.body.model || 'deepseek-chat';

    console.log('📄 Parsing PDF:', req.file.originalname, `(${req.file.size} bytes)`);
    const parser = new PDFParse({ data: req.file.buffer });
    const pdfData = await parser.getText();
    const textContent = pdfData.text;
    await parser.destroy();
    console.log(`✅ PDF Parsed. Extracted ${textContent.length} characters.`);

    // We will chunk the text into roughly 20,000 characters per chunk
    const maxChars = 20000;
    const chunks = [];
    for (let i = 0; i < textContent.length; i += maxChars) {
      chunks.push(textContent.slice(i, i + maxChars));
    }

    const jobId = uuidv4();
    extractionJobs.set(jobId, {
      status: 'processing',
      progress: `Initializing chunk 1 of ${chunks.length}...`,
      currentChunk: 0,
      totalChunks: chunks.length,
      services: [],
      error: null,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });

    const systemPrompt = `You are a data extraction assistant.
The user has provided a chunk of text from an Oracle Fusion Services Privileges PDF document.
Extract the structured data (services and their associated costed privileges) from the text.
Provide a strictly formatted JSON response consisting of a root object with a "services" key. The value of "services" must be an array of objects.
Each object in the array must have exactly these keys:
- "service_code": A short code or identifier for the service (e.g. "HCM", "ERP") or derived from the name if not present (MUST BE A STRING).
- "service_name": The full name of the service (MUST BE A STRING).
- "content": A brief description of the service (MUST BE A STRING).
- "privileges": An array of strings, where each string is the exact name of a privilege associated with this service (MUST BE AN ARRAY OF STRINGS).
Output ONLY valid JSON without any markdown formatting.`;

    // Process in background
    (async () => {
      const job = extractionJobs.get(jobId);
      try {
        for (let i = 0; i < chunks.length; i++) {
          job.currentChunk = i + 1;
          job.progress = `Extracting chunk ${i + 1} of ${chunks.length}...`;
          console.log(`🤖 [Job ${jobId}] Processing chunk ${i + 1}/${chunks.length}...`);

          const aiResp = await generateAIContent(selectedModel, systemPrompt, chunks[i], 0.1, true);
          let parsed = JSON.parse(aiResp.content);

          if (parsed && !Array.isArray(parsed)) {
            const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
            parsed = arrayKey ? parsed[arrayKey] : [parsed];
          }

          job.services.push(...(parsed || []));


          if (aiResp.usage) {
            job.usage.prompt_tokens += aiResp.usage.prompt_tokens || 0;
            job.usage.completion_tokens += aiResp.usage.completion_tokens || 0;
            job.usage.total_tokens += aiResp.usage.total_tokens || 0;
          }

          // Give a very small delay (1 second) to be polite, DeepSeek limits are much higher than Groq
          if (i < chunks.length - 1) {
            job.progress = `Finished chunk ${i + 1}. Moving to chunk ${i + 2}...`;
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        // Finalize
        job.status = 'completed';
        job.progress = `Successfully extracted ${job.services.length} services!`;
        console.log(`✅ [Job ${jobId}] Completed. Total services: ${job.services.length}`);
      } catch (err) {
        console.error(`❌ [Job ${jobId}] Failed:`, err);
        job.status = 'error';
        job.error = err.message || String(err);
      }
    })();

    return res.json({ jobId, totalChunks: chunks.length });

  } catch (err) {
    console.error('Error starting PDF extraction:', err);
    return res.status(500).json({ error: 'Internal server error during extraction initialization: ' + (err.message || String(err)) });
  }
});

app.get('/api/settings/privileges/extract/status/:jobId', (req, res) => {
  const job = extractionJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json(job);
});

/* ── BALANCE ENDPOINT ────────────────────────────────────────────────────────── */
app.get('/api/settings/balance', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const response = await fetch('https://api.deepseek.com/user/balance', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch balance' });
    }
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error('Error fetching balance:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/settings/privileges', async (req, res) => {
  try {
    const configData = req.body;
    if (!configData || !Array.isArray(configData)) {
      return res.status(400).json({ error: 'Invalid configuration data. Must be a JSON array.' });
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: CONFIG_S3_KEY,
      Body: JSON.stringify(configData, null, 2),
      ContentType: 'application/json',
    });

    await s3.send(command);
    cachedPrivilegesConfig = configData;
    console.log(`✅ Configuration saved to S3: ${CONFIG_S3_KEY}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error saving configuration:', err);
    return res.status(500).json({ error: 'Failed to save configuration to S3' });
  }
});

app.get('/api/settings/privileges', async (req, res) => {
  try {
    const buf = await s3ToBuffer(CONFIG_S3_KEY);
    const configData = JSON.parse(buf.toString('utf-8'));
    return res.json(configData);
  } catch (err) {
    console.error('Error fetching configuration (might not exist yet):', err.message);
    return res.status(404).json({ error: 'Configuration not found' });
  }
});

app.delete('/api/settings/privileges', async (req, res) => {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: CONFIG_S3_KEY }));
    cachedPrivilegesConfig = null;
    console.log(`🗑️ Deleted configuration from S3: ${CONFIG_S3_KEY}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting configuration:', err);
    return res.status(500).json({ error: 'Failed to delete configuration' });
  }
});

/* ── CONFIGURATION ENDPOINTS (Cost Sheet) ────────────────────────────── */

const costExtractionJobs = new Map();

app.post('/api/settings/costsheet/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Uploaded file must be a PDF' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const selectedModel = req.body.model || 'deepseek-chat';

    const jobId = uuidv4();

    costExtractionJobs.set(jobId, {
      status: 'processing',
      progress: `Initializing extraction...`,
      currentChunk: 0,
      totalChunks: 1,
      costs: [],
      error: null,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });

    // Process in background
    (async () => {
      const job = costExtractionJobs.get(jobId);
      try {
        job.progress = 'Reading known services from configuration...';

        let knownServiceNames = [];
        try {
          const configBuf = await s3ToBuffer(CONFIG_S3_KEY);
          const parsedConfig = JSON.parse(configBuf.toString('utf-8'));
          const services = parsedConfig.services || parsedConfig;
          knownServiceNames = services.map(s => s.service_name || s.serviceName).filter(Boolean);
        } catch (e) {
          console.warn('Could not read known services, proceeding without filter');
        }

        job.progress = 'Parsing PDF document...';
        console.log('📄 Parsing Cost Sheet PDF:', req.file.originalname, `(${req.file.size} bytes)`);
        const parser = new PDFParse({ data: req.file.buffer });
        const pdfData = await parser.getText();
        const textContent = pdfData.text;
        await parser.destroy();
        console.log(`✅ PDF Parsed. Extracted ${textContent.length} characters.`);

        // Chunk size 25000 chars to avoid hitting max_tokens on output
        const maxChars = 25000;
        const chunks = [];
        for (let i = 0; i < textContent.length; i += maxChars) {
          chunks.push(textContent.slice(i, i + maxChars));
        }
        job.totalChunks = chunks.length;

        const systemPrompt = `You are a data extraction assistant processing an Oracle Cost Sheet PDF.
We are only interested in finding the Monthly Subscription Price for a specific list of Known Services.
${knownServiceNames.length > 0 ? `Known Services List:\n${knownServiceNames.join('\n')}\n\nDo not extract prices for any services not in this list.` : ''}

Provide a strictly formatted JSON response consisting of a root object with a "costs" key. The value of "costs" must be an array of objects.
Each object must have exactly these keys:
- "partNumber": The exact Part Number/SKU (MUST BE A STRING).
- "serviceName": The exact name of the service from the Known Services List (MUST BE A STRING).
- "cost": The numeric Monthly Subscription Price, ignoring setup fees (MUST BE A NUMBER).
Output ONLY valid JSON without markdown formatting. Do not output anything if no costs are found in this chunk.`;

        for (let i = 0; i < chunks.length; i++) {
          job.currentChunk = i + 1;
          job.progress = `Extracting chunk ${i + 1} of ${chunks.length}...`;
          console.log(`🤖 [Cost Job ${jobId}] Processing chunk ${i + 1}/${chunks.length}...`);

          const aiResp = await generateAIContent(selectedModel, systemPrompt, chunks[i], 0.1, true);
          const rawContent = aiResp.content;

          try {
            let parsed = JSON.parse(rawContent);
            if (parsed && !Array.isArray(parsed)) {
              const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
              parsed = arrayKey ? parsed[arrayKey] : [parsed];
            }
            job.costs.push(...(parsed || []));
          } catch (e) {
            console.error(`❌ [Cost Job ${jobId}] Failed to parse JSON on chunk ${i + 1}. Raw content was:`, rawContent.substring(0, 100) + '...');
          }

          if (aiResp.usage) {
            job.usage.prompt_tokens += aiResp.usage.prompt_tokens || 0;
            job.usage.completion_tokens += aiResp.usage.completion_tokens || 0;
            job.usage.total_tokens += aiResp.usage.total_tokens || 0;
          }

          if (i < chunks.length - 1) {
            job.progress = `Finished chunk ${i + 1}. Moving to chunk ${i + 2}...`;
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        job.status = 'completed';
        job.progress = 'Extraction complete!';
        console.log(`✅ [Cost Job ${jobId}] Finished. Extracted ${job.costs.length} items.`);
      } catch (err) {
        console.error(`❌ [Cost Job ${jobId}] Failed:`, err);
        job.status = 'error';
        job.error = err.message || 'Background extraction failed';
      }
    })();

    return res.json({ success: true, jobId, message: 'Cost extraction started' });
  } catch (err) {
    console.error('Error starting cost extraction:', err);
    return res.status(500).json({ error: 'Failed to start extraction' });
  }
});

app.get('/api/settings/costsheet/extract/status/:jobId', (req, res) => {
  const job = costExtractionJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.post('/api/settings/costsheet/save', express.json(), async (req, res) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Expected an array of extracted costs' });
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: 'config/global_cost_sheet_data.json',
      // Invalidate cache

      Body: Buffer.from(JSON.stringify(data)),
      ContentType: 'application/json',
    });
    await s3.send(command);

    cachedCostSheetData = data;
    return res.json({ success: true, message: 'Cost sheet data saved successfully.' });
  } catch (err) {
    console.error('Error saving cost sheet data:', err);
    return res.status(500).json({ error: 'Failed to save cost sheet data' });
  }
});

app.get('/api/settings/costsheet', async (req, res) => {
  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: 'config/global_cost_sheet_data.json' });
    await s3.send(cmd);
    return res.json({ exists: true });
  } catch (e) {
    return res.status(404).json({ exists: false });
  }
});

app.delete('/api/settings/costsheet', async (req, res) => {
  try {
    const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: 'config/global_cost_sheet_data.json' });
    await s3.send(cmd);
    cachedCostSheetData = null;
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete' });
  }
});

/* ── REMEDIATION & ROLE SWAP API ────────────────────────────────────────────── */

function deriveRoleCode(roleName) {
  if (!roleName) return 'CUSTOM_ROLE_JOB';
  // If already looks like a code (e.g. ORA_... or contains underscores)
  const clean = roleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (clean.startsWith('ORA_')) return clean;
  return `ORA_${clean}_JOB`;
}

function deriveCustomRoleCode(originalCode, customName) {
  if (customName) {
    const clean = customName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (clean.startsWith('XX_')) return clean;
    return `XX_${clean}`;
  }
  if (originalCode.startsWith('ORA_')) {
    return 'XX_' + originalCode.slice(4);
  }
  return `XX_${originalCode}`;
}

app.post('/api/remediation/plan', express.json(), async (req, res) => {
  try {
    const { serviceName, roleName, employeeName, employeeId, costlyPrivilege, customRoleName, customRoleCode } = req.body;

    const origRoleName = roleName || 'OTL Administrator US';
    const origRoleCode = deriveRoleCode(origRoleName);
    const newRoleName = customRoleName || `XX_${origRoleName}`;
    const newRoleCode = customRoleCode || deriveCustomRoleCode(origRoleCode, newRoleName);
    const empName = employeeName || 'Parveen';
    const empId = employeeId || '100597';

    // Find all costly privileges under this service for this role if cachedResult exists
    const costlyPrivs = [];
    if (cachedResult && cachedResult.services) {
      const svc = cachedResult.services.find(s => s.name === serviceName || s.id === serviceName);
      if (svc && Array.isArray(svc.privileges)) {
        for (const priv of svc.privileges) {
          const hasRole = (priv.roles || []).some(r => r.name.toLowerCase() === origRoleName.toLowerCase());
          if (hasRole) {
            costlyPrivs.push({
              name: priv.name,
              id: priv.id,
              costPerUser: priv.costPerUser || svc.unitCost || 0,
            });
          }
        }
      }
    }

    // If none found from cache, ensure at least the provided costlyPrivilege or sample default is included
    if (costlyPrivs.length === 0) {
      if (costlyPrivilege) {
        costlyPrivs.push({ name: costlyPrivilege, id: costlyPrivilege, costPerUser: 0 });
      } else {
        costlyPrivs.push(
          { name: 'HWM_MANAGE_TIME_WORK_AREA_PRIV', id: 'HWM_MANAGE_TIME_WORK_AREA_PRIV', costPerUser: 0 },
          { name: 'HWM_TIME_MANAGEMENT_WORK_AREA_PRIV', id: 'HWM_TIME_MANAGEMENT_WORK_AREA_PRIV', costPerUser: 0 }
        );
      }
    }

    // Format Oracle HCM Data Loader (User.dat) syntax
    const hdlLines = [
      'METADATA|UserRole|PersonNumber|RoleCommonName|AddRemoveRole',
      `MERGE|UserRole|${empId}|${origRoleCode}|REMOVE`,
      `MERGE|UserRole|${empId}|${newRoleCode}|ADD`,
    ];
    const hdlContent = hdlLines.join('\n');

    // Format SCIM v2 REST API payloads
    const scimRevoke = {
      method: 'PATCH',
      url: `/hcmRestApi/scim/Roles/<${origRoleCode}_GUID>`,
      headers: { 'Content-Type': 'application/scim+json', 'Authorization': 'Bearer <TOKEN>' },
      body: { members: [{ value: `<${empName.toUpperCase()}_USER_GUID>`, operation: 'REMOVE' }] }
    };

    const scimAssign = {
      method: 'PATCH',
      url: `/hcmRestApi/scim/Roles/<${newRoleCode}_GUID>`,
      headers: { 'Content-Type': 'application/scim+json', 'Authorization': 'Bearer <TOKEN>' },
      body: { members: [{ value: `<${empName.toUpperCase()}_USER_GUID>`, operation: 'ADD' }] }
    };

    // Format Oracle Security Console SOP
    const sopSteps = [
      `1. Log in to Oracle Fusion Cloud as IT Security Manager.`,
      `2. Navigate to: Navigator > Tools > Security Console > Roles.`,
      `3. Search for seeded role: "${origRoleName}" (${origRoleCode}).`,
      `4. Click the Actions menu (down arrow) > Select "Copy Role" > Choose "Copy top role and inherited roles".`,
      `5. In Step 1 (Basic Information): Set Role Name to "${newRoleName}" and Role Code to "${newRoleCode}".`,
      `6. In Step 2 (Function Security Privileges): Find and DELETE the following costly privileges:\n   ${costlyPrivs.map(p => `• ${p.name}`).join('\n   ')}`,
      `7. (Optional): Click "Add Function Security Privilege" and add read-only/free duty roles (e.g. HWM_TIME_CARD_ENTRY_DUTY).`,
      `8. Complete the wizard and click "Submit and Close". Wait ~2 minutes for ES indexes to refresh.`,
      `9. Run HDL (User.dat) or use User Accounts UI to remove "${origRoleName}" and assign "${newRoleName}" to ${empName}.`,
      `10. Run Scheduled Process: "Send Pending LDAP Requests" to finalize security synchronization.`
    ];

    return res.json({
      success: true,
      serviceName: serviceName || 'Oracle Fusion Time and Labor Cloud Service',
      originalRole: { name: origRoleName, code: origRoleCode },
      customRole: { name: newRoleName, code: newRoleCode },
      targetEmployee: { name: empName, id: empId, login: empName.toLowerCase() },
      assignmentType: 'DIRECT',
      costlyPrivileges: costlyPrivs,
      hdlContent,
      scimRevoke,
      scimAssign,
      sopSteps,
    });
  } catch (err) {
    console.error('Error generating remediation plan:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/remediation/download-hdl', express.json(), (req, res) => {
  const { hdlContent, filename } = req.body;
  const content = hdlContent || 'METADATA|UserRole|PersonNumber|RoleCommonName|AddRemoveRole\n';
  const outName = filename || 'User.dat';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
  return res.send(content);
});

app.get('/api/remediation/oracle-config', (_req, res) => {
  const host = process.env.ORACLE_HOST || process.env.ORACLE_POD_URL;
  const username = process.env.ORACLE_USERNAME;
  return res.json({
    configured: Boolean(host && username && process.env.ORACLE_PASSWORD),
    host: host ? host.replace(/^https?:\/\//, '') : null,
    fullHost: host || null,
    username: username || null,
  });
});

app.post('/api/remediation/oracle-auto-clone', express.json(), async (req, res) => {
  try {
    const podUrl = req.body.podUrl || process.env.ORACLE_HOST || process.env.ORACLE_POD_URL;
    const username = req.body.username || process.env.ORACLE_USERNAME;
    const password = req.body.password || process.env.ORACLE_PASSWORD;
    const {
      roles,
      originalRoleName,
      customRoleName,
      customRoleCode,
      privilegeToStrip,
      replacementPrivilege,
      employees,
      headless = process.env.ORACLE_PUPPETEER_HEADLESS !== 'false'
    } = req.body;

    if (!podUrl || !username || !password) {
      return res.status(400).json({ error: 'Oracle credentials not configured in backend .env (ORACLE_HOST, ORACLE_USERNAME, ORACLE_PASSWORD).' });
    }

    const rawRoles = (Array.isArray(roles) && roles.length > 0)
      ? roles
      : (originalRoleName ? [{
        originalRoleName,
        customRoleName: customRoleName || `XX_${originalRoleName}`,
        customRoleCode: customRoleCode || deriveCustomRoleCode(deriveRoleCode(originalRoleName), customRoleName),
        employees: Array.isArray(employees) ? employees : []
      }] : []);

    const targetRoles = rawRoles.map(r => ({
      ...r,
      employees: (Array.isArray(r.employees) && r.employees.length > 0)
        ? r.employees
        : (Array.isArray(employees) && employees.length > 0 ? employees : []),
      replacementPrivilege: r.replacementPrivilege || replacementPrivilege || null
    }));

    if (targetRoles.length === 0 || !privilegeToStrip) {
      return res.status(400).json({ error: 'At least one role and privilegeToStrip are required.' });
    }

    const jobId = `rpa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const primaryRole = targetRoles[0];

    // Launch RPA background execution
    executeOracleRoleRemediation({
      jobId,
      podUrl,
      username,
      password,
      roles: targetRoles,
      originalRoleName: primaryRole.originalRoleName,
      customRoleName: primaryRole.customRoleName,
      customRoleCode: primaryRole.customRoleCode,
      privilegeToStrip,
      replacementPrivilege,
      employees: (Array.isArray(primaryRole.employees) && primaryRole.employees.length > 0)
        ? primaryRole.employees
        : (Array.isArray(employees) ? employees : []),
      headless: Boolean(headless)
    }).catch(err => {
      console.error(`[Oracle RPA] Background execution error on ${jobId}:`, err.message);
    });

    return res.json({
      success: true,
      jobId,
      message: `Oracle Cloud RPA automation initiated for ${targetRoles.length} role(s).`,
      rolesCount: targetRoles.length,
      targetRoles,
      target: {
        originalRoleName: primaryRole.originalRoleName,
        customRoleName: primaryRole.customRoleName,
        customRoleCode: primaryRole.customRoleCode,
        privilegeToStrip
      }
    });
  } catch (err) {
    console.error('Error starting Oracle RPA automation:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/remediation/oracle-jobs', (_req, res) => {
  return res.json(getAllJobs ? getAllJobs() : []);
});

app.get('/api/remediation/oracle-status/:jobId', (req, res) => {
  const job = getJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'RPA Job not found.' });
  }
  return res.json(job);
});

/* ── HIERARCHY REMEDIATION ENDPOINT ──────────────────────────────────────────
 *
 * POST /api/remediation/oracle-hierarchy-remediate
 *
 * Body:
 *  {
 *    targetUsername:   "Parveen",           // HCM username to remediate
 *    targetRoleName:   "OTL Administrator US",  // Top-level role on the user
 *    costlyPrivileges: [
 *      {
 *        privilegeName:    "HWM_MANAGE_TIME_WORK_AREA_PRIV",
 *        freeAlternative:  "HWM_VIEW_TIME_WORK_AREA_PRIV",
 *        parentServiceName:"Fusion Cloud Time & Labor"
 *      },
 *      ...
 *    ],
 *    headless: true
 *  }
 *
 * Recursive Logic:
 *   For each costlyPrivilege:
 *     1. Find its immediate parent service
 *     2. Create XX_ copy of that service, remove costly priv, add free alt
 *     3. If parent service directly on user → swap assignment
 *        If inherited → copy parent role too, replace seeded service with XX_,
 *                       then swap user's role assignment
 * ─────────────────────────────────────────────────────────────────────────── */
app.post('/api/remediation/oracle-hierarchy-remediate', express.json(), async (req, res) => {
  try {
    const podUrl = req.body.podUrl || process.env.ORACLE_HOST || process.env.ORACLE_POD_URL;
    const username = req.body.username || process.env.ORACLE_USERNAME;
    const password = req.body.password || process.env.ORACLE_PASSWORD;
    const headless = req.body.headless !== undefined
      ? Boolean(req.body.headless)
      : process.env.ORACLE_PUPPETEER_HEADLESS !== 'false';

    const {
      targetUsername,
      targetRoleName,
      customRoleName,
      customRoleCode,
      costlyPrivileges = []
    } = req.body;

    if (!podUrl || !username || !password) {
      return res.status(400).json({
        error: 'Oracle credentials not configured. Set ORACLE_HOST, ORACLE_USERNAME, ORACLE_PASSWORD in backend .env.'
      });
    }

    if (!targetUsername || !targetRoleName) {
      return res.status(400).json({
        error: 'targetUsername and targetRoleName are required.'
      });
    }

    if (!costlyPrivileges || costlyPrivileges.length === 0) {
      return res.status(400).json({
        error: 'At least one costlyPrivilege entry is required.'
      });
    }

    const jobId = `rpa_hier_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Launch hierarchy remediation as a background job
    executeHierarchyRemediation({
      jobId, podUrl, username, password,
      targetUsername,
      targetRoleName,
      customRoleName,
      customRoleCode,
      costlyPrivileges,
      headless
    }).catch(err => {
      console.error(`[Oracle Hierarchy RPA] Background error on ${jobId}:`, err.message);
    });

    return res.json({
      success: true,
      jobId,
      message: `Hierarchy remediation job initiated for user "${targetUsername}".`,
      target: {
        user: targetUsername,
        role: targetRoleName,
        privilegesCount: costlyPrivileges.length,
        privileges: costlyPrivileges.map(p => p.privilegeName)
      }
    });
  } catch (err) {
    console.error('Error starting Oracle Hierarchy RPA:', err);
    return res.status(500).json({ error: err.message });
  }
});

/* ── USER AUDIT ENDPOINTS (Oracle Demo Instance) ───────────────────────── */
const { fetchUserAuditHistory, getUserFullRoleAudit, syncLiveOracleAudit, generateFullAuditCsv } = require('./services/oracleAuditService');

app.get('/api/user-audit/config', (_req, res) => {
  const host = process.env.ORACLE_HOST || process.env.ORACLE_POD_URL;
  const username = process.env.ORACLE_USERNAME;
  return res.json({
    configured: Boolean(host && username && process.env.ORACLE_PASSWORD),
    host: host ? host.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null,
    username: username || null,
  });
});

app.get('/api/user-audit/export-csv', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 90;
    const search = req.query.search || req.query.q || '';
    const sortBy = req.query.sortBy || 'name_asc';
    const status = req.query.status || 'All';
    const csvData = await generateFullAuditCsv({ threshold, search, sortBy, status });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Oracle_User_Audit_Full_Export_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csvData);
  } catch (err) {
    console.error('Error generating full audit CSV export:', err);
    return res.status(500).json({ error: err.message || 'Failed to export CSV' });
  }
});

app.get('/api/user-audit/history', async (req, res) => {
  try {
    const forceFresh = req.query.fresh === 'true';
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const threshold = parseInt(req.query.threshold, 10) || 90;
    const search = req.query.search || req.query.q || '';
    const sortBy = req.query.sortBy || 'name_asc';
    const auditData = await fetchUserAuditHistory({ forceFresh, limit, offset, threshold, search, sortBy });
    return res.json(auditData);
  } catch (err) {
    console.error('Error fetching user audit history:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch user audit history' });
  }
});

app.post('/api/user-audit/sync-live', express.json(), async (req, res) => {
  try {
    const threshold = parseInt(req.body.threshold, 10) || 90;
    const limit = parseInt(req.body.limit, 10) || 50;
    const offset = parseInt(req.body.offset, 10) || 0;
    const search = req.body.search || '';
    const sortBy = req.body.sortBy || 'name_asc';
    const liveData = await syncLiveOracleAudit({ threshold, forceFresh: true, limit, offset, search, sortBy });
    return res.json(liveData);
  } catch (err) {
    console.error('Error during live sync with Oracle Cloud:', err);
    return res.status(500).json({ error: err.message || 'Live audit synchronization failed' });
  }
});

app.get('/api/user-audit/user/:username/roles', async (req, res) => {
  try {
    const { username } = req.params;
    const threshold = parseInt(req.query.threshold, 10) || 90;
    const roleData = await getUserFullRoleAudit(username, threshold);
    return res.json(roleData);
  } catch (err) {
    console.error('Error fetching full roles for user:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch user roles' });
  }
});

/* ── FUNCTIONAL CONFLICTS / SOD AUDIT ENDPOINTS ───────────────────────────── */
const { detectFunctionalConflicts, loadSodRules } = require('./services/sodConflictService');
const { stripPrivilegeFromOracleRole, revokeRoleFromOracleUser } = require('./services/oracleSodRemediation');

const sodJobs = new Map();

app.get('/api/sod/rules', (_req, res) => {
  return res.json(loadSodRules());
});

app.get('/api/sod/conflicts', async (req, res) => {
  try {
    const forceFresh = req.query.fresh === 'true';
    const limit = parseInt(req.query.limit, 10) || 100;
    const conflictData = await detectFunctionalConflicts({ forceFresh, limit });
    return res.json(conflictData);
  } catch (err) {
    console.error('Error detecting functional conflicts:', err);
    return res.status(500).json({ error: err.message || 'Failed to detect functional conflicts' });
  }
});

app.get('/api/sod/status/:jobId', (req, res) => {
  const job = sodJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'SoD Remediation job not found.' });
  }
  return res.json(job);
});

app.post('/api/sod/remediate', express.json(), async (req, res) => {
  const {
    username,
    roleToRevoke,
    targetRole,
    privilegeToStrip,
    privilegeCode,
    strategy = 'STRIP_PRIVILEGE',
    customRoleName,
    customRoleCode,
    headless = true,
    ruleId,
    conflictName
  } = req.body;

  const effectiveRole = targetRole || roleToRevoke;
  if (!username || !effectiveRole) {
    return res.status(400).json({ error: 'Username and targetRole/roleToRevoke are required.' });
  }

  const jobId = 'sod_job_' + Date.now();
  const startTime = new Date();

  const isStripPrivilege = strategy === 'STRIP_PRIVILEGE';
  const isHeadless = Boolean(headless);
  const initialJob = {
    jobId,
    username,
    roleToRevoke: effectiveRole,
    targetRole: effectiveRole,
    privilegeToStrip: privilegeToStrip || 'Conflicting Privilege',
    privilegeCode: privilegeCode || 'P01',
    strategy,
    headless: isHeadless,
    ruleId: ruleId || 'SOD-019',
    conflictName: conflictName || 'Segregation of Duties Conflict',
    status: 'STARTING',
    progress: 10,
    currentStep: isStripPrivilege
      ? `Initializing Privilege Stripping Agent for "${effectiveRole}" (${isHeadless ? 'Headless' : 'Visible Browser'})...`
      : `Initializing Role Revocation Agent for "${effectiveRole}" (${isHeadless ? 'Headless' : 'Visible Browser'})...`,
    logs: [
      `[${startTime.toLocaleTimeString()}] 🚀 Initiated Automated SoD Remediation Studio for "${username}".`,
      `[${startTime.toLocaleTimeString()}] 🛡️ Target Role: "${effectiveRole}".`,
      `[${startTime.toLocaleTimeString()}] 🖥️ Verification Browser: ${isHeadless ? 'Headless (Capturing Verification Proof Screenshots)' : 'Visible (Interactive Window on Desktop)'}.`,
      isStripPrivilege
        ? `[${startTime.toLocaleTimeString()}] ✂️ Remediation Strategy: Strip privilege "${privilegeToStrip || privilegeCode}" & preserve user capabilities.`
        : `[${startTime.toLocaleTimeString()}] 🗑️ Remediation Strategy: De-provision entire role "${effectiveRole}".`,
      `[${startTime.toLocaleTimeString()}] 📜 Compliance Rule: ${ruleId || 'SOD-RULE'}.`
    ],
    createdAt: startTime.toISOString()
  };

  sodJobs.set(jobId, initialJob);

  const updateJob = (updates) => {
    const current = sodJobs.get(jobId) || {};
    sodJobs.set(jobId, { ...current, ...updates, updatedAt: new Date().toISOString() });
  };

  // Route to either Privilege Stripping (Recommended) or Role Revocation
  if (isStripPrivilege) {
    stripPrivilegeFromOracleRole({
      username,
      roleName: effectiveRole,
      roleCode: req.body.roleCode || '',
      privilegeToStrip,
      privilegeCode,
      customRoleName,
      customRoleCode,
      ruleId,
      jobId,
      headless: isHeadless,
      updateJob
    }).catch((err) => {
      console.error(`[SoD Strip Bot] Error on ${jobId}:`, err);
      const cur = sodJobs.get(jobId) || {};
      sodJobs.set(jobId, {
        ...cur,
        status: 'FAILED',
        currentStep: `Remediation failed: ${err.message}`,
        logs: [...(cur.logs || []), `[${new Date().toLocaleTimeString()}] ❌ Failed: ${err.message}`]
      });
    });
  } else {
    revokeRoleFromOracleUser({
      username,
      roleName: effectiveRole,
      roleCode: req.body.roleCode || '',
      ruleId,
      jobId,
      headless: isHeadless,
      updateJob
    }).catch((err) => {
      console.error(`[SoD Revoke Bot] Error on ${jobId}:`, err);
      const cur = sodJobs.get(jobId) || {};
      sodJobs.set(jobId, {
        ...cur,
        status: 'FAILED',
        currentStep: `Remediation failed: ${err.message}`,
        logs: [...(cur.logs || []), `[${new Date().toLocaleTimeString()}] ❌ Failed: ${err.message}`]
      });
    });
  }

  return res.json({
    success: true,
    jobId,
    strategy,
    message: isStripPrivilege
      ? `Privilege stripping initiated for "${username}": removing "${privilegeToStrip || privilegeCode}" from "${effectiveRole}".`
      : `Role revocation initiated for "${username}": removing "${effectiveRole}".`,
    timestamp: new Date().toISOString()
  });
});

/* ── SERVER START ───────────────────────────────────────────────────────────── */
const server = app.listen(PORT, () => {
  console.log('')
  console.log('🚀  HCM Upload Server started')
  console.log(`    URL:    http://localhost:${PORT}`)
  console.log(`    Bucket: ${BUCKET}  (${process.env.AWS_REGION})`)
  console.log(`    CORS:   ${ORIGIN}`)
  console.log('')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other server or set $env:PORT='3002' before running npm run dev.`)
    process.exitCode = 1
    return
  }

  console.error('Server failed to start:', err)
  process.exitCode = 1
})

module.exports = app;
