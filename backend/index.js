require('dotenv').config()

const express   = require('express')
const cors      = require('cors')
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { v4: uuidv4 }  = require('uuid')
const XLSX = require('xlsx')
const multer = require('multer')
const { PDFParse } = require('pdf-parse')
const { VertexAI } = require('@google-cloud/vertexai');

const vertex_ai = new VertexAI({ project: process.env.GCP_PROJECT_ID || 'project-b7e4de28-72cd-4ca3-92a', location: 'us-central1' });

async function generateAIContent(selectedModel, systemPrompt, userPrompt, temperature, isJson) {
  if (selectedModel.startsWith('gemini')) {
    const genModel = vertex_ai.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        temperature,
        responseMimeType: isJson ? "application/json" : "text/plain",
      },
      systemInstruction: { parts: [{ text: systemPrompt }] }
    });
    
    const request = {
      contents: [{ role: 'user', parts: [{ text: userPrompt || 'Proceed.' }] }]
    };
    
    const resp = await genModel.generateContent(request);
    const content = resp.response.candidates[0].content.parts[0].text;
    
    // Parse usage
    const usageMetadata = resp.response.usageMetadata || {};
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
const missing  = REQUIRED.filter(k => !process.env[k])
if (missing.length) {
  console.error('Ã¢ÂÅ’  Missing required environment variables:', missing.join(', '))
  console.error('    Copy server/.env.example Ã¢â€ â€™ server/.env and fill in your values.')
  process.exit(1)
}

const PORT   = process.env.PORT            || 3001
const BUCKET = process.env.S3_BUCKET_NAME
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const CONFIG_S3_KEY = 'config/oracle_fusion_services_privileges.json'

/* Ã¢â€â‚¬Ã¢â€â‚¬ AWS S3 client Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
})

/* Ã¢â€â‚¬Ã¢â€â‚¬ Express app Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const app = express()

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true)
    } else {
      callback(null, ORIGIN)
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}))

app.use(express.json({ limit: '10mb' }))

/* Ã¢â€â‚¬Ã¢â€â‚¬ Health check Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', bucket: BUCKET, region: process.env.AWS_REGION })
})

/* Ã¢â€â‚¬Ã¢â€â‚¬ POST /api/presigned-url
     Body:  { filename: string, contentType: string }
     Returns: { uploadUrl: string, s3Key: string }
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
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
    const ext    = filename.includes('.') ? filename.split('.').pop() : 'bin'
    const s3Key  = `uploads/${uuidv4()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         s3Key,
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
let cachedResult = null

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
    const svc   = (row.SERVICE       || '').trim()
    const user  = (row.USER_LOGIN    || '').trim()
    const priv  = (row.PRIVILEGE     || row.PRIVILEGE_NAME || '').trim()
    const role  = (row.ROLE_NAME     || '').trim()
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

  for (const row of rows) {
    const svcRaw  = (row.SERVICE || row['Service Name'] || '').trim()
    const sku = (row.SKU || '').trim()
    if (!svcRaw || !sku) continue
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
            id:         login,
            name:       login,
            email:      `${login.toLowerCase()}@corp.com`,
            department: '',
            status,
            avatar:     login.slice(0, 2).toUpperCase(),
          };
        })
        roles.push({
          id:            `${svcName}|${privName}|${roleName}`,
          name:          roleName || '(No Role)',
          employeeCount: employees.length,
          licenseUsed:   employees.length,
          licenseTotal:  employees.length,
          employees,
        })
      }

      const totalUsersForPriv = new Set(roles.flatMap(r => r.employees.map(e => e.id))).size
      privileges.push({
        id:          `${svcName}|${privName}`,
        name:        privName,
        description: `${privName} - ${totalUsersForPriv} user${totalUsersForPriv !== 1 ? 's' : ''}`,
        costPerUser: 0,
        totalCost:   0,
        usageCount:  totalUsersForPriv,
        usageLimit:  0,
        risk:        'medium',
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
      id:              svcName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
      name:            svcName,
      sku:             finalSku,
      vendor:          '',
      icon:            '🏢',
      color:           palette.color,
      bgGradient:      palette.bg,
      totalCost:       totalCost,
      licenseCount,
      billableQuantity,
      billingUnits,
      minimumQuantity: minQty,
      metric,
      unitCost,
      overageCost,
      privilegeCount:  privileges.length,
      overProvisioned: overProvisioned,
      subscribedQuantity,
      privileges,
    })
  }

  services.sort((a, b) => b.licenseCount - a.licenseCount)

  return {
    processedAt:   new Date().toISOString(),
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
  try {
    const s3Key = req.body.xlsxS3Key || req.body.s3Key;
    const summaryS3Key = req.body.summaryS3Key;
    const statusS3Key = req.body.statusS3Key;

    let costSheetData = [];
    try {
      const buf = await s3ToBuffer('config/global_cost_sheet_data.json');
      costSheetData = JSON.parse(buf.toString('utf-8'));
      console.log(`✅ Loaded global cost sheet data: ${costSheetData.length} prices`);
    } catch (e) {
      console.log('⚠️ No global cost sheet data found. Proceeding without costs.');
    }
    
    let privilegesConfig = [];
    try {
      console.log(`⚙️    Fetching config from S3: ${CONFIG_S3_KEY}`);
      const buf = await s3ToBuffer(CONFIG_S3_KEY);
      const configData = buf.toString('utf-8');
      const parsedConfig = JSON.parse(configData);
      if (parsedConfig.services) {
        privilegesConfig = parsedConfig.services;
      } else {
        privilegesConfig = parsedConfig;
      }
    } catch (err) {
      console.warn(`⚠️    Config not found in S3 or error reading it:`, err.message);
    }

    const subscribedQuantityMap = new Map();
    if (summaryS3Key) {
      try {
        console.log(`⚙️    Processing Summary Sheet: ${summaryS3Key}`);
        const summaryBuf = await s3ToBuffer(summaryS3Key);
        const summaryWb = XLSX.read(summaryBuf, { type: 'buffer' });
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
    const activeStatusMap = new Map();
    if (statusS3Key) {
      try {
        console.log(`⚙️    Processing Active Status: ${statusS3Key}`)
        const statusBuf = await s3ToBuffer(statusS3Key)
        const statusWb = XLSX.read(statusBuf, { type: 'buffer' })
        const statusSheetName = statusWb.SheetNames.includes('Sheet1') ? 'Sheet1' : statusWb.SheetNames[0]
        const statusRows = XLSX.utils.sheet_to_json(statusWb.Sheets[statusSheetName], { defval: '' })
        
        for (const row of statusRows) {
          if (row['User Name']) {
            const normalizedRole = (row['Role Name'] || '').trim().toLowerCase().replace(/_/g, ' ');
            const key = `${row['User Name'].toLowerCase()}|${normalizedRole}`;
            const isActive = row['User Suspended'] === 'No';
            activeStatusMap.set(key, isActive);
          }
        }
        console.log(`✅ Extracted ${activeStatusMap.size} statuses from User Status Sheet`)
      } catch(err) {
        console.warn(`⚠️ Error processing User Status Sheet:`, err.message);
      }
    }

    console.log(`⚙️    Processing: ${s3Key}`)
    const buf = await s3ToBuffer(s3Key)
    const wb  = XLSX.read(buf, { type: 'buffer' })

    const sheetName = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' })

    console.log(`   Parsed ${rows.length} rows from sheet "${sheetName}"`)

    cachedResult = buildHierarchy(rows, privilegesConfig, costSheetData, subscribedQuantityMap, activeStatusMap)
    console.log(`✅  Result built: ${cachedResult.services.length} services, ${cachedResult.totalLicences} licences`)

    return res.json({ ok: true, services: cachedResult.services.length, totalLicences: cachedResult.totalLicences })
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
    const { privilegeName, model } = req.body;
    if (!privilegeName) return res.status(400).json({ error: 'privilegeName is required' });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const selectedModel = model || 'deepseek-chat';

    const systemPrompt = `You are an Oracle HCM Licensing Expert. 
The user is asking about the privilege: "${privilegeName}".
This is a costed privilege that incurs a licensing fee.
Provide a strictly formatted JSON response with exactly these keys:
- "explanation": A 3 to 4 sentence explanation of what this privilege is and what functionality it provides (MUST BE A STRING).
- "isCostedMessage": A short confirmation that this privilege incurs a cost (max 2 sentences, MUST BE A STRING).
- "alternative": A suggested free or lower-cost alternative privilege or functional workaround (MUST BE A STRING).
- "impact": The functional impact on the user if this privilege is removed and the alternative is used (MUST BE A STRING).
Output ONLY valid JSON where EVERY value is a simple string without any markdown formatting or nested objects.`;

    const aiResp = await generateAIContent(selectedModel, systemPrompt, null, 0.2, true);
    const parsed = JSON.parse(aiResp.content);
    
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
            console.error(`❌ [Cost Job ${jobId}] Failed to parse JSON on chunk ${i+1}. Raw content was:`, rawContent.substring(0, 100) + '...');
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
      Body: Buffer.from(JSON.stringify(data)),
      ContentType: 'application/json',
    });
    await s3.send(command);

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
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete' });
  }
});

/* ── SERVER START ───────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log('')
  console.log('🚀  HCM Upload Server started')
  console.log(`    URL:    http://localhost:${PORT}`)
  console.log(`    Bucket: ${BUCKET}  (${process.env.AWS_REGION})`)
  console.log(`    CORS:   ${ORIGIN}`)
  console.log('')
})
