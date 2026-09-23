import React, { useState, useEffect } from 'react';
import { Search, ArrowDownLeft, ArrowUpRight, AlertTriangle, Inbox } from 'lucide-react';
import { supabase } from '../config/supabase';

export default function ActivityLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // all | entry | exit | failed

  const fetchLogs = async () => {
    try {
      const { data } = await supabase
        .from('verification_logs')
        .select(`
          *,
          bookings(
            booking_code,
            parking_slots(slot_number),
            vehicles(vehicle_number),
            users(full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (data && data.length > 0) {
        setLogs(data.map(l => {
          const dt = new Date(l.created_at || Date.now());
          return {
            id:       String(l.log_id),
            vehicle:  l.bookings?.vehicles?.vehicle_number || '—',
            customer: l.bookings?.users?.full_name || 'Walk-in',
            code:     l.bookings?.booking_code || '—',
            slot:     l.bookings?.parking_slots?.slot_number || '—',
            action:   l.action,
            type:     l.action === 'ENTRY_SCAN' ? 'entry' : 'exit',
            status:   l.status || 'SUCCESS',
            remarks:  l.remarks || '—',
            time:     dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            date:     dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            raw:      dt,
          };
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const sub = supabase.channel('logs-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'verification_logs' }, fetchLogs)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const filtered = logs.filter(l => {
    const filterOk = filter === 'all' ||
      (filter === 'entry'  && l.type === 'entry') ||
      (filter === 'exit'   && l.type === 'exit') ||
      (filter === 'failed' && ['EXPIRED','FAILED','REJECTED'].includes(l.status));

    const q = search.toLowerCase();
    const searchOk = !q ||
      l.vehicle.toLowerCase().includes(q) ||
      l.customer.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q) ||
      l.slot.toLowerCase().includes(q) ||
      l.remarks.toLowerCase().includes(q);

    return filterOk && searchOk;
  });

  const counts = {
    total:  logs.length,
    entry:  logs.filter(l => l.type === 'entry').length,
    exit:   logs.filter(l => l.type === 'exit').length,
    failed: logs.filter(l => ['EXPIRED','FAILED','REJECTED'].includes(l.status)).length,
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Activity Logs</h1>
          <p>Verification audit trail from Supabase database · {counts.total} records</p>
        </div>
        <span className="live-badge"><span className="live-dot" />Live Stream</span>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Logs',  count: counts.total,  color: '#0052cc', bg: '#EFF6FF' },
          { label: 'Entry Scans', count: counts.entry,  color: '#10B981', bg: '#D1FAE5' },
          { label: 'Exit Scans',  count: counts.exit,   color: '#2563EB', bg: '#DBEAFE' },
          { label: 'Failed',      count: counts.failed, color: '#EF4444', bg: '#FEE2E2' },
        ].map(c => (
          <div key={c.label} className="stat-card" style={{ '--card-accent': c.color, flex: 1, minWidth: 120 }}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ color: c.color, fontSize: 26 }}>{c.count}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center' }}><Search size={16} color="#94A3B8" /></span>
            <input className="form-input" placeholder="Search by vehicle, customer, code, slot…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {[
            { key: 'all',    label: 'All Logs' },
            { key: 'entry',  label: 'Entry' },
            { key: 'exit',   label: 'Exit' },
            { key: 'failed', label: 'Failed' },
          ].map(f => (
            <button key={f.key} className={`filter-pill${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Fetching logs…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><Inbox size={32} color="#94A3B8" /></div>
            <p>No verification logs found in database.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Booking Code</th>
                  <th>Slot</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const isEntry  = l.type === 'entry';
                  const isFailed = ['EXPIRED','FAILED','REJECTED'].includes(l.status);
                  return (
                    <tr key={l.id}>
                      <td>
                        <span className={`badge ${isFailed ? 'badge-red' : isEntry ? 'badge-green' : 'badge-blue'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {isFailed ? <AlertTriangle size={12} /> : isEntry ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                          {isFailed ? 'Failed' : isEntry ? 'Entry' : 'Exit'}
                        </span>
                      </td>
                      <td><strong>{l.vehicle}</strong></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{l.customer}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: 'var(--blue)' }}>{l.code}</span>
                      </td>
                      <td><span className="badge badge-blue">{l.slot}</span></td>
                      <td>
                        <span className={`badge ${isFailed ? 'badge-red' : 'badge-green'}`}>{l.status}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 200 }}>{l.remarks}</td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{l.time}</div>
                        <div>{l.date}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

