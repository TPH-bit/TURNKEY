export const SYSTEM_CONFIG = {
  MAX_UPLOAD_FILES: parseInt(process.env.MAX_UPLOAD_FILES || '5'),
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '2'),
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_MB || '2') * 1024 * 1024,
  SESSION_RETENTION_HOURS: parseInt(process.env.SESSION_RETENTION_HOURS || '24'),
  
  ALLOWED_FILE_TYPES: ['pdf', 'docx', 'txt', 'md', 'pptx'],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],

  LLM_TEMPERATURE: 0.3,
  LLM_MAX_TOKENS: 4000,
  
  CHUNK_SIZE: 800,
  CHUNK_OVERLAP: 100,
  TOP_K_CHUNKS: 15,
  MIN_CITATIONS_PER_SECTION: 2,
  
  RELIABILITY_SCORES: {
    academic: 1.0,
    institutional: 0.95,
    media_recognized: 0.8,
    encyclopedia: 0.7,
    uploaded: 0.85,
    unknown: 0.5
  }
};

export const TRUSTED_DOMAINS = [
  'scholar.google.com',
  'pubmed.ncbi.nlm.nih.gov',
  'arxiv.org',
  'who.int',
  'cdc.gov',
  'nih.gov',
  'nasa.gov',
  'europa.eu',
  'un.org',
  'bbc.com',
  'nytimes.com',
  'reuters.com',
  'lemonde.fr',
  'wikipedia.org',
  'britannica.com'
];

export const BLOCKED_DOMAINS = [];
