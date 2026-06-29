import OpenAI from 'openai';
import { redis } from '../utils/session.js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Predetermined reporting topics. Incoming employee questions are grouped into
// exactly one of these for dashboard/HR analytics. Insurance/benefits domain.
export const REPORT_TOPICS = [
  { name: 'Coverage', hint: 'what is covered, claim limits, coverage amounts, balances, eligibility, what can be claimed' },
  { name: 'Claims', hint: 'how to submit or file a claim, claim deadlines, claim status, reimbursement, Medisave authorisation' },
  { name: 'Referral', hint: 'referral letters, specialist referrals, second opinions, polyclinic referrals' },
  { name: 'Panel Clinics', hint: 'finding GP or specialist panel lists, panel clinic payments, which clinics to visit' },
  { name: 'Account/Login', hint: 'login problems, passwords, user ID, OTP, phone number changes, portal access' },
  { name: 'LOG', hint: 'Letter of Guarantee requests' },
  { name: 'Other', hint: 'greetings, thanks, or anything that does not fit the topics above' }
];

const VALID_TOPICS = new Set(REPORT_TOPICS.map(topic => topic.name));
const TOPIC_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Resolve the reporting topic for a question, using a Redis cache keyed by the
 * query hash so identical questions are classified by the LLM only once.
 */
export async function resolveQuestionTopic({ message, schemaName, queryHash }) {
  const cacheKey = `topic:${schemaName}:${queryHash}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached && VALID_TOPICS.has(cached)) return cached;
  } catch (error) {
    console.error('[topic] cache read failed:', error.message);
  }

  const topic = await classifyTopic(message);

  try {
    await redis.set(cacheKey, topic, 'EX', TOPIC_TTL_SECONDS);
  } catch (error) {
    console.error('[topic] cache write failed:', error.message);
  }

  return topic;
}

async function classifyTopic(message) {
  const list = REPORT_TOPICS.map(topic => `- ${topic.name}: ${topic.hint}`).join('\n');
  const prompt = `Categorize this employee question to an insurance/benefits helpdesk into ONE topic.
Topics:
${list}
Reply with ONLY the exact topic name from the list above.
Question: "${message.substring(0, 300)}"`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 10
  });

  const output = (response.choices[0]?.message?.content || '').trim();
  const lower = output.toLowerCase();

  const exact = REPORT_TOPICS.find(topic => topic.name.toLowerCase() === lower);
  if (exact) return exact.name;

  const partial = REPORT_TOPICS.find(topic => lower.includes(topic.name.toLowerCase()));
  return partial ? partial.name : 'Other';
}
