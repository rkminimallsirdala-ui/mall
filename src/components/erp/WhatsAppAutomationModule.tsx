import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import { MessageLog } from '../../types/erp';

interface ProviderStatus {
  whatsappConfigured: boolean;
  smsConfigured: boolean;
  emailConfigured: boolean;
}

export const WhatsAppAutomationModule: React.FC = () => {
  const {
    language,
    messageTemplates,
    setMessageTemplates,
    messageLogs,
    customers,
    upsertCustomer,
    dispatchNotification,
    storeSettings,
    showToast,
  } = useMall();

  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(messageTemplates[0]?.id || '');
  const [recipient, setRecipient] = useState(storeSettings.whatsappPhone);
  const [customMessage, setCustomMessage] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/notifications/status')
      .then((r) => r.json())
      .then((data) => setProviderStatus(data))
      .catch(() => setProviderStatus(null));
  }, []);

  const selectedTemplate = messageTemplates.find((m) => m.id === selectedTemplateId) || messageTemplates[0];

  useEffect(() => {
    if (selectedTemplate) {
      setCustomMessage(language === 'hi' ? selectedTemplate.bodyHi : selectedTemplate.bodyEn);
      setChannel(selectedTemplate.channel);
    }
  }, [selectedTemplate, language]);

  const handleDispatchTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !customMessage.trim()) return;
    setSending(true);
    try {
      await dispatchNotification({
        channel,
        recipient: recipient.trim(),
        trigger: selectedTemplate?.trigger || 'manual_dispatch',
        body: customMessage.trim(),
      });
    } finally {
      setSending(false);
    }
  };

  const handleRetryLog = async (log: MessageLog) => {
    await dispatchNotification({
      channel: log.channel,
      recipient: log.recipient,
      trigger: log.trigger,
      body: log.body,
    });
  };

  const updateTemplateBody = (id: string, body: string) => {
    setMessageTemplates((prev) =>
      prev.map((t) =>
        t.id === id ? (language === 'hi' ? { ...t, bodyHi: body } : { ...t, bodyEn: body }) : t
      )
    );
    showToast('Template text updated.', 'success');
  };

  return (
    <div className="space-y-5">
      {/* Provider Configuration Honesty Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              WhatsApp, SMS & Email Automation Hub
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All 18 Hindi & English business notification templates + honest server gateway status
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${
                providerStatus?.whatsappConfigured
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              {providerStatus?.whatsappConfigured ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              WhatsApp API: {providerStatus?.whatsappConfigured ? 'Configured' : 'Not Configured'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              SMS: {providerStatus?.smsConfigured ? 'Configured' : 'Not Configured'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              Email: {providerStatus?.emailConfigured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          When external API keys (<code className="font-mono">WHATSAPP_ACCESS_TOKEN</code>,{' '}
          <code className="font-mono">WHATSAPP_PHONE_NUMBER_ID</code>,{' '}
          <code className="font-mono">SMS_GATEWAY_API_KEY</code>) are not configured on the server, dispatches log truthfully as{' '}
          <code className="font-mono font-bold">failed_not_configured</code> instead of faking delivery.
        </p>
      </div>

      {/* 18 Templates + Dispatch Console */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 max-h-[540px] overflow-y-auto">
          <h3 className="text-sm font-bold mb-2">18 Automation Triggers & Templates</h3>
          {messageTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedTemplateId(tpl.id)}
              className={`w-full text-left p-3 rounded-lg border text-xs transition-colors ${
                selectedTemplate?.id === tpl.id
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="font-bold">{language === 'hi' ? tpl.titleHi : tpl.titleEn}</span>
                <span className="uppercase text-[10px] font-mono text-slate-500">{tpl.channel}</span>
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {language === 'hi' ? tpl.bodyHi : tpl.bodyEn}
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-7 space-y-5">
          {/* Dispatch Form */}
          <form
            onSubmit={handleDispatchTest}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Edit Template & Dispatch Message
              </h3>
              <span className="font-mono text-[11px] text-slate-500">{selectedTemplate?.trigger}</span>
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold mb-1">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as 'whatsapp' | 'sms' | 'email')}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="whatsapp">WhatsApp Cloud API</option>
                  <option value="sms">SMS Gateway</option>
                  <option value="email">Email Webhook</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Recipient Phone / Email</label>
                <input
                  type="text"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Message Content ({language.toUpperCase()})</label>
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3"
              />
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => selectedTemplate && updateTemplateBody(selectedTemplate.id, customMessage)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Save Template Changes
              </button>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Dispatching...' : 'Send via Server Gateway'}
              </button>
            </div>
          </form>

          {/* Delivery Logs */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <h3 className="text-sm font-bold">Delivery Logs & Retry Queue</h3>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2">Recipient</th>
                    <th className="py-2">Trigger</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Provider Response</th>
                    <th className="py-2 text-right">Retry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {messageLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 font-mono">{log.recipient}</td>
                      <td className="py-2">{log.trigger}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${
                            log.status === 'sent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 text-slate-500 max-w-[200px] truncate">{log.providerResponse}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRetryLog(log)}
                          className="inline-flex items-center gap-1 text-amber-600 font-semibold hover:underline"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Consent & Unsubscribe Controls */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <h3 className="text-sm font-bold">Customer Marketing Consent & Opt-Out</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {customers.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <span>
                    <strong>{c.name}</strong> ({c.mobile})
                  </span>
                  <input
                    type="checkbox"
                    checked={c.marketingConsent}
                    onChange={(e) => upsertCustomer({ ...c, marketingConsent: e.target.checked })}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
