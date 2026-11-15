import { pushMessage } from './alerts.mjs';

export async function deliver(store, sender, now = Date.now(), report = () => {}) {
  for (const job of store.due(now)) {
    const installation = store.get(job.installation);
    if (!installation) { store.removeJob(job.id); continue; }
    try {
      if (job.ticket) {
        if (now - job.created > 24 * 60 * 60_000) { store.removeJob(job.id); continue; }
        const receipt = await sender.receipt(job.ticket);
        if (!receipt) { store.postpone(job, now); continue; }
        if (receipt.status === 'error') report(receipt.details?.error || 'receipt_error');
        if (receipt.details?.error === 'DeviceNotRegistered') store.removeToken(job.installation, job.ticket_token);
        // Receipt status is provider acceptance, not proof of display on a phone.
        if (receipt.details?.error === 'MessageRateExceeded') store.retry(job, now);
        else if (receipt.status === 'ok' || receipt.status === 'error') store.removeJob(job.id);
        else store.postpone(job, now);
      } else {
        if (now - job.created > 5 * 60_000) { store.removeJob(job.id); continue; }
        const ticket = await sender.send(pushMessage(job, installation.token, store.brokerUrl));
        if (ticket.status === 'ok' && typeof ticket.id === 'string') store.ticket(job, ticket.id, installation.token, now);
        else {
          report(ticket.details?.error || 'ticket_error');
          if (ticket.details?.error === 'DeviceNotRegistered') store.removeToken(job.installation, installation.token);
          else store.retry(job, now);
        }
      }
    } catch {
      report('transport_error');
      if (job.ticket) store.postpone(job, now);
      else store.retry(job, now);
    }
  }
}
