import React, { useState, useEffect } from 'react';
import { ClipboardList, Search, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '../config/supabase';

const STATUS_BADGE = {
  CONFIRMED:  'badge-green',
  PENDING:    'badge-amber',
  COMPLETED:  'badge-blue',
  CANCELLED:  'badge-red',
  ACTIVE:     'badge-green',
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilter] = useState('all');
  const [toast, setToast]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchBookings = async () => {
    try {
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          parking_slots(slot_number, parking_locations(name)),
          vehicles(vehicle_number),
          users(full_name, email)
        `)
        .order('created_at', { ascending: false });
      setBookings(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    const sub = supabase.channel('bookings-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const cancelBooking = async (b) => {
    if (!window.confirm(`Cancel booking ${b.booking_code}?`)) return;
    await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('booking_id', b.booking_id);
    showToast(`Booking ${b.booking_code} cancelled`);
    fetchBookings();
  };

  const filtered = bookings.filter(b => {
    const statusOk = filterStatus === 'all' || b.status === filterStatus;
    const q = search.toLowerCase();
    const searchOk = !q ||
      b.booking_code?.toLowerCase().includes(q) ||
      b.users?.full_name?.toLowerCase().includes(q) ||
      b.vehicles?.vehicle_number?.toLowerCase().includes(q) ||
      b.parking_slots?.slot_number?.toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const counts = {};
  ['CONFIRMED','PENDING','COMPLETED','CANCELLED'].forEach(s => {
    counts[s] = bookings.filter(b => b.status === s).length;
  });

  return (
    <div className="page-body">
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#0F172A', color: '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div className="page-header-text">
          <h1>Bookings</h1>
          <p>{bookings.length} total reservations in the database</p>
        </div>
        <span className="live-badge"><span className="live-dot" />Real-time</span>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className={`badge ${STATUS_BADGE[status] || 'badge-gray'}`} style={{ fontSize: 13, padding: '6px 14px', cursor: 'pointer' }} onClick={() => setFilter(status === filterStatus ? 'all' : status)}>
            {count} {status}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center' }}><Search size={16} color="#94A3B8" /></span>
            <input className="form-input" placeholder="Search by code, user, vehicle, slot…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {['all','CONFIRMED','PENDING','COMPLETED','CANCELLED'].map(s => (
            <button key={s} className={`filter-pill${filterStatus === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Loading bookings…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><ClipboardList size={32} color="#94A3B8" /></div>
            <p>No bookings found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking Code</th>
                  <th>User</th>
                  <th>Vehicle</th>
                  <th>Slot</th>
                  <th>Location</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.booking_id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--blue)', fontSize: 13 }}>{b.booking_code}</span></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{b.users?.full_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.users?.email || ''}</div>
                    </td>
                    <td><strong>{b.vehicles?.vehicle_number || '—'}</strong></td>
                    <td><span className="badge badge-blue">{b.parking_slots?.slot_number || '—'}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{b.parking_slots?.parking_locations?.name || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmt(b.start_time)}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmt(b.end_time)}</td>
                    <td><span className={`badge ${STATUS_BADGE[b.status] || 'badge-gray'}`}>{b.status}</span></td>
                    <td>
                      {b.status === 'CONFIRMED' || b.status === 'PENDING' ? (
                        <button className="btn btn-danger btn-xs" onClick={() => cancelBooking(b)}>Cancel</button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

