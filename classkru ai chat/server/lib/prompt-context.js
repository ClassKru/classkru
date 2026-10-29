'use strict';

function positiveInt(value, fallback, max) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}

function buildV3Messages({ message, context, history, brief, actionRegistry }) {
  const screens = new Set(actionRegistry.map(action => action.screen));
  const requestedScreen = String(context?.screen || '');
  const modelContext = {
    screen: screens.has(requestedScreen) ? requestedScreen : 'unknown',
    hasSelectedClass: Boolean(context?.selectedClassId || context?.hasSelectedClass)
  };
  const allowedActions = actionRegistry.map(({ id, label, requiresClass }) => ({
    id,
    label,
    ...(requiresClass ? { requiresClass: true } : {})
  }));
  const systemPrompt = [
    brief.system,
    brief.navigation,
    `บริบทปัจจุบัน: ${JSON.stringify(modelContext)}`,
    `Action Registry ที่อนุญาต: ${JSON.stringify(allowedActions)}`
  ].join('\n\n');
  const maxHistory = positiveInt(brief.config.maxHistoryTurns, 8, 16);
  const previousMessages = (Array.isArray(history) ? history : []).slice(-maxHistory).map(turn => ({
    role: turn?.role === 'assistant' ? 'assistant' : 'user',
    content: String(turn?.content || '').slice(0, 800)
  })).filter(turn => turn.content);

  return [
    { role: 'system', content: systemPrompt },
    ...previousMessages,
    { role: 'user', content: String(message || '') }
  ];
}

module.exports = { buildV3Messages };
