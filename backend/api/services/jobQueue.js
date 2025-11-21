import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL for BullMQ connection
const parseRedisUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 6379,
      password: urlObj.password || undefined,
      username: urlObj.username || undefined,
    };
  } catch (error) {
    console.error('Error parsing Redis URL:', error);
    return {
      host: 'localhost',
      port: 6379
    };
  }
};

const redisConnection = parseRedisUrl(REDIS_URL);

/**
 * Document Processing Queue
 * Handles background PDF processing with retries and error handling
 */
export const documentQueue = new Queue('document-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 10s, then 60s
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours (for debugging)
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days (for investigation)
    },
  },
});

// Event handlers for monitoring
documentQueue.on('error', (error) => {
  console.error('Document queue error:', error);
});

documentQueue.on('waiting', (jobId) => {
  console.log(`Document job ${jobId} is waiting`);
});

documentQueue.on('active', (job) => {
  console.log(`Document job ${job.id} started processing`);
});

documentQueue.on('completed', (job) => {
  console.log(`Document job ${job.id} completed successfully`);
});

documentQueue.on('failed', (job, error) => {
  console.error(`Document job ${job?.id} failed:`, error.message);
});

/**
 * Add document processing job to queue
 * @param {Object} jobData - Job payload
 * @param {string} jobData.documentId - Document UUID
 * @param {string} jobData.filePath - Path to uploaded PDF
 * @param {string} jobData.companySchema - Company schema name
 * @param {string} jobData.uploadedBy - Admin user ID
 * @param {string} [jobData.category] - Optional pre-selected category
 * @returns {Promise<Object>} - Job object with ID
 */
export async function addDocumentProcessingJob(jobData) {
  try {
    const job = await documentQueue.add('process-document', jobData, {
      jobId: jobData.documentId, // Use documentId as jobId for easy tracking
    });

    console.log(`Document processing job created: ${job.id}`);
    return job;
  } catch (error) {
    console.error('Error adding document processing job:', error);
    throw error;
  }
}

/**
 * Get job status and progress
 * @param {string} jobId - Job ID (same as documentId)
 * @returns {Promise<Object>} - Job status info
 */
export async function getJobStatus(jobId) {
  try {
    const job = await documentQueue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const failedReason = job.failedReason;

    return {
      status: state, // 'waiting', 'active', 'completed', 'failed'
      progress,
      failedReason,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    console.error('Error getting job status:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Get queue metrics for monitoring
 * @returns {Promise<Object>} - Queue metrics
 */
export async function getQueueMetrics() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      documentQueue.getWaitingCount(),
      documentQueue.getActiveCount(),
      documentQueue.getCompletedCount(),
      documentQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active,
    };
  } catch (error) {
    console.error('Error getting queue metrics:', error);
    return null;
  }
}

/**
 * Clean old completed/failed jobs
 * @param {number} grace - Grace period in milliseconds
 */
export async function cleanOldJobs(grace = 86400000) {
  try {
    await documentQueue.clean(grace, 100, 'completed');
    await documentQueue.clean(grace * 7, 100, 'failed');
    console.log('Old jobs cleaned successfully');
  } catch (error) {
    console.error('Error cleaning old jobs:', error);
  }
}

/**
 * Close queue connection (for graceful shutdown)
 */
export async function closeQueue() {
  try {
    await documentQueue.close();
    console.log('Document queue closed');
  } catch (error) {
    console.error('Error closing document queue:', error);
  }
}

export default {
  documentQueue,
  addDocumentProcessingJob,
  getJobStatus,
  getQueueMetrics,
  cleanOldJobs,
  closeQueue,
};
