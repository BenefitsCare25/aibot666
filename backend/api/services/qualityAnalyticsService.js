const PAGE_SIZE = 1000;

export async function getQualityAnalytics(supabaseClient, { startDate, endDate } = {}) {
  const metrics = createMetrics();

  await Promise.all([
    scanPages(
      page => buildMessageQuery(supabaseClient, page, startDate, endDate),
      rows => aggregateMessages(metrics, rows)
    ),
    scanPages(
      page => buildEscalationQuery(supabaseClient, page, startDate, endDate),
      rows => aggregateEscalations(metrics, rows)
    )
  ]);

  return formatMetrics(metrics);
}

function buildMessageQuery(client, page, startDate, endDate) {
  let query = client
    .from('chat_history')
    .select('id, role, content, metadata, sources, created_at')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, ((page + 1) * PAGE_SIZE) - 1);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  return query;
}

function buildEscalationQuery(client, page, startDate, endDate) {
  let query = client
    .from('escalations')
    .select('query, context, status, created_at')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, ((page + 1) * PAGE_SIZE) - 1);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  return query;
}

async function scanPages(buildQuery, consume) {
  for (let page = 0; ; page += 1) {
    const { data, error } = await buildQuery(page);
    if (error) throw error;
    const rows = data || [];
    consume(rows);
    if (rows.length < PAGE_SIZE) return;
  }
}

function createMetrics() {
  return {
    assistantCount: 0,
    userCount: 0,
    ratedCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    latencyTotal: 0,
    latencies: [],
    tokenTotal: 0,
    actionCounts: new Map(),
    similarityBins: [0, 0, 0, 0],
    topicQuestions: new Map(),
    escalationCount: 0,
    resolvedCount: 0,
    escalationClusters: new Map(),
    escalationCategories: new Map(),
    recentNegativeFeedback: []
  };
}

function aggregateMessages(metrics, messages) {
  messages.forEach(message => {
    if (message.role === 'user') {
      metrics.userCount += 1;
      const topic = message.metadata?.topic;
      if (topic) addTopicQuestion(metrics.topicQuestions, topic, message.content);
      return;
    }
    if (message.role !== 'assistant') return;

    metrics.assistantCount += 1;
    increment(metrics.actionCounts, message.metadata?.action || 'legacy');
    addLatency(metrics, message.metadata?.latency_ms);
    metrics.tokenTotal += Number(message.metadata?.tokens) || 0;
    addSimilarity(metrics.similarityBins, message.metadata?.best_similarity);
    addFeedback(metrics, message);
  });
}

function aggregateEscalations(metrics, escalations) {
  escalations.forEach(escalation => {
    metrics.escalationCount += 1;
    if (escalation.status === 'resolved') metrics.resolvedCount += 1;

    const category = escalationCategory(escalation);
    increment(metrics.escalationCategories, category);
    addEscalationCluster(metrics.escalationClusters, escalation, category);
  });
}

function addLatency(metrics, rawLatency) {
  const latency = Number(rawLatency);
  if (!Number.isFinite(latency)) return;
  metrics.latencyTotal += latency;
  metrics.latencies.push(latency);
}

function addSimilarity(bins, rawSimilarity) {
  const similarity = Number(rawSimilarity);
  if (!Number.isFinite(similarity)) return;
  if (similarity < 0.55) bins[0] += 1;
  else if (similarity < 0.7) bins[1] += 1;
  else if (similarity < 0.85) bins[2] += 1;
  else bins[3] += 1;
}

function addFeedback(metrics, message) {
  const feedback = message.metadata?.feedback;
  if (!feedback?.rating) return;

  metrics.ratedCount += 1;
  if (feedback.rating === 'positive') metrics.positiveCount += 1;
  if (feedback.rating !== 'negative') return;

  metrics.negativeCount += 1;
  if (metrics.recentNegativeFeedback.length < 10) {
    metrics.recentNegativeFeedback.push({
      messageId: message.id,
      answer: message.content,
      reason: feedback.reason,
      submittedAt: feedback.submitted_at,
      sources: message.sources || []
    });
  }
}

// Group a question under its topic, de-duplicating identical phrasings.
function addTopicQuestion(topicMap, topic, content = '') {
  const key = normalizeQuestion(content);
  if (!key) return;
  let questions = topicMap.get(topic);
  if (!questions) {
    questions = new Map();
    topicMap.set(topic, questions);
  }
  const existing = questions.get(key) || { question: content.substring(0, 200), count: 0 };
  existing.count += 1;
  questions.set(key, existing);
}

function formatTopicQuestions(topicMap) {
  return [...topicMap.entries()]
    .map(([topic, questions]) => {
      const list = [...questions.values()].sort((a, b) => b.count - a.count);
      const total = list.reduce((sum, item) => sum + item.count, 0);
      return { topic, total, questions: list };
    })
    .sort((a, b) => b.total - a.total);
}

function addEscalationCluster(clusters, escalation, category) {
  const key = normalizeQuestion(escalation.query);
  if (!key) return;
  const existing = clusters.get(key) || {
    question: escalation.query.substring(0, 160),
    count: 0,
    category
  };
  existing.count += 1;
  clusters.set(key, existing);
}

function formatMetrics(metrics) {
  metrics.latencies.sort((a, b) => a - b);
  const questionsByTopic = formatTopicQuestions(metrics.topicQuestions);
  return {
    summary: {
      totalQuestions: metrics.userCount,
      totalAnswers: metrics.assistantCount,
      escalations: metrics.escalationCount,
      ratedAnswers: metrics.ratedCount,
      positiveFeedback: metrics.positiveCount,
      negativeFeedback: metrics.negativeCount,
      helpfulRate: percentage(metrics.positiveCount, metrics.ratedCount),
      averageLatencyMs: metrics.latencies.length
        ? Math.round(metrics.latencyTotal / metrics.latencies.length)
        : 0,
      p95LatencyMs: percentile(metrics.latencies, 0.95),
      totalTokens: metrics.tokenTotal,
      averageTokens: metrics.assistantCount
        ? Math.round(metrics.tokenTotal / metrics.assistantCount)
        : 0,
      escalationRate: percentage(metrics.escalationCount, metrics.userCount),
      resolutionRate: percentage(metrics.resolvedCount, metrics.escalationCount)
    },
    actions: mapToSortedArray(metrics.actionCounts),
    similarityDistribution: formatSimilarityBins(metrics.similarityBins),
    topicDistribution: questionsByTopic.map(item => ({ label: item.topic, count: item.total })),
    questionsByTopic,
    unansweredClusters: topClusters(metrics.escalationClusters, false),
    escalationCategories: mapToSortedArray(metrics.escalationCategories),
    recentNegativeFeedback: metrics.recentNegativeFeedback
  };
}

function formatSimilarityBins(bins) {
  const labels = ['< 0.55', '0.55-0.69', '0.70-0.84', '>= 0.85'];
  return labels.map((label, index) => ({ label, count: bins[index] }));
}

function topClusters(clusters, repeatedOnly) {
  return [...clusters.values()]
    .filter(item => !repeatedOnly || item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function mapToSortedArray(counts) {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function increment(counts, key) {
  counts.set(key, (counts.get(key) || 0) + 1);
}

function escalationCategory(escalation) {
  return escalation.context?.sources?.[0]?.category || 'Uncategorized';
}

function normalizeQuestion(value = '') {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(the|a|an|is|are|do|does|what|how|can|i|my|for|to|of)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120);
}

function percentage(numerator, denominator) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function percentile(sortedValues, quantile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * quantile) - 1
  );
  return sortedValues[index];
}
