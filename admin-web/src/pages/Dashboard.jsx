import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  SquareParking, 
  CheckCircle2, 
  Car, 
  ClipboardList, 
  IndianRupee, 
  Inbox, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight 
} from 'lucide-react';
import { supabase } from '../config/supabase';

const WEEKLY_DATA = [
  { day: 'Mon', pct: 65 }, { day: 'Tue', pct: 78 }, { day: 'Wed', pct: 70 },
  { day: 'Thu', pct: 85 }, { day: 'Fri', pct: 92 }, { day: 'Sat', pct: 88 },
  { day: 'Sun', pct: 55 },
];

const STAT_CARDS = (s) => [
  { label: 'Total Locations', value: s.totalLots,       icon: MapPin,        accent: '#0052cc', change: 'Active', changeCls: 'badge-blue' },
  { label: 'Total Slots',     value: s.totalSlots,      icon: SquareParking, accent: '#7C3AED', change: 'Configured', changeCls: 'badge-purple' },
  { label: 'Available Slots', value: s.availableSlots,  icon: CheckCircle2,  accent: '#10B981', change: 'Free', changeCls: 'badge-green' },
  { label: 'Occupied/Reserved',value: s.occupiedSlots,  icon: Car,           accent: '#EF4444', change: 'In use', changeCls: 'badge-red' },
  { label: 'Total Bookings',  value: s.totalBookings,   icon: ClipboardList, accent: '#F59E0B', change: 'All time', changeCls: 'badge-amber' },
  { label: 'Total Revenue',   value: `₹${s.totalRevenue.toLocaleString()}`, icon: IndianRupee, accent: '#10B981', change: 'Collected', changeCls: 'badge-green' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalLots: 0, totalSlots: 0, availableSlots: 0,
    occupiedSlots: 0, totalBookings: 0, totalRevenue: 0,
  });
  const [activity, setActivity]  = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const fetchStats = async () => {
    try {
      const [{ data: locs }, { data: slots }, { data: bookings }, { data: payments }] = await Promise.all([
        supabase.from('parking_locations').select('location_id'),
        supabase.from('parking_slots').select('slot_id,status'),
        supabase.from('bookings').select('booking_id'),
        supabase.from('payments').select('amount'),
      ]);

      setStats({
        totalLots:     locs?.length ?? 0,
        totalSlots:    slots?.length ?? 0,
        availableSlots: slots?.filter(s => s.status === 'AVAILABLE').length ?? 0,
        occupiedSlots:  slots?.filter(s => ['OCCUPIED','RESERVED'].includes(s.status)).length ?? 0,
        totalBookings:  bookings?.length ?? 0,
        totalRevenue:   payments?.reduce((acc, p) => acc + Number(p.amount || 0), 0) ?? 0,
      });
    } catch (e) {
      console.error('fetchStats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const { data: logs } = await supabase
        .from('verification_logs')
        .select('*, bookings(booking_code, parking_slots(slot_number), vehicles(vehicle_number), users(full_name))')
        .order('created_at', { ascending: false })
        .limit(10);

      if (logs && logs.length > 0) {
        setActivity(logs.map(l => ({
          id:       String(l.log_id),
          vehicle:  l.bookings?.vehicles?.vehicle_number || 'N/A',
          customer: l.bookings?.users?.full_name || 'Walk-in',
          code:     l.bookings?.booking_code || '—',
          slot:     l.bookings?.parking_slots?.slot_number || '—',
          type:     l.action === 'ENTRY_SCAN' ? 'in' : 'out',
          status:   l.status || 'SUCCESS',
          time:     new Date(l.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          date:     new Date(l.created_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
        })));
      } else {
        // Fallback to bookings if no logs
        const { data: bks } = await supabase
          .from('bookings')
          .select('*, parking_slots(slot_number), vehicles(vehicle_number), users(full_name)')
          .order('created_at', { ascending: false })
          .limit(10);
        if (bks) {
          setActivity(bks.map(b => ({
            id:       String(b.booking_id),
            vehicle:  b.vehicles?.vehicle_number || 'N/A',
            customer: b.users?.full_name || 'User',
            code:     b.booking_code || '—',
            slot:     b.parking_slots?.slot_number || '—',
            type:     'in',
            status:   b.status === 'CONFIRMED' ? 'SUCCESS' : b.status,
            time:     new Date(b.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            date:     new Date(b.created_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
          })));
        }
      }
    } catch (e) {
      console.error('fetchActivity:', e);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchActivity();

    // Real-time subscriptions
    const slotSub = supabase.channel('dashboard-slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_slots' }, fetchStats)
      .subscribe();
    const bkSub = supabase.channel('dashboard-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { fetchStats(); fetchActivity(); })
      .subscribe();

    return () => { supabase.removeChannel(slotSub); supabase.removeChannel(bkSub); };
  }, []);

  const cards = STAT_CARDS(stats);
  const availPct = stats.totalSlots ? Math.round((stats.availableSlots / stats.totalSlots) * 100) : 0;
  const occupPct = stats.totalSlots ? Math.round((stats.occupiedSlots  / stats.totalSlots) * 100) : 0;

  return (
    <div className="page-body">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Performance Overview</h1>
          <p>Live data from your Supabase database · auto-refreshes in real-time</p>
        </div>
      </div>

      {/* Stats Grid */}
      {loadingStats ? (
        <div className="loading-spinner"><div className="spinner" /> Loading live stats…</div>
      ) : (
        <div className="stats-grid">
          {cards.map((c, i) => {
            const IconComp = c.icon;
            return (
              <div key={i} className="stat-card" style={{ '--card-accent': c.accent }}>
                <div className="stat-label">{c.label}</div>
                <div className="stat-value">{c.value}</div>
                <div className="stat-icon-row">
                  <span className={`badge ${c.changeCls}`}>{c.change}</span>
                  <div className="stat-icon-bg" style={{ background: c.accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconComp size={18} color={c.accent} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts + Activity */}
      <div className="dashboard-grid">
        {/* Weekly Chart */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Weekly Slot Occupancy</div>
              <div className="card-subtitle">Occupancy trend this week</div>
            </div>
            <div className="donut-wrap" style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <div className="donut-legend-item"><div className="donut-legend-dot" style={{ background: '#10B981' }} />Available {availPct}%</div>
              <div className="donut-legend-item"><div className="donut-legend-dot" style={{ background: '#EF4444' }} />Occupied {occupPct}%</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-bars-row">
              {WEEKLY_DATA.map(d => (
                <div key={d.day} className="chart-col">
                  <div className="bar-val">{d.pct}%</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ height: `${d.pct}%` }} />
                  </div>
                  <div className="bar-label">{d.day}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slot Distribution */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Slot Distribution</div>
              <div className="card-subtitle">Current status breakdown</div>
            </div>
          </div>
          <div className="card-body">
            {[
              { label: 'Available', count: stats.availableSlots, color: '#10B981', bg: '#D1FAE5' },
              { label: 'Occupied',  count: stats.occupiedSlots,  color: '#EF4444', bg: '#FEE2E2' },
              { label: 'Other',     count: Math.max(0, stats.totalSlots - stats.availableSlots - stats.occupiedSlots), color: '#94A3B8', bg: '#F1F5F9' },
            ].map(item => {
              const pct = stats.totalSlots ? Math.round((item.count / stats.totalSlots) * 100) : 0;
              return (
                <div key={item.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: item.color }}>{item.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 99, transition: 'width .6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Activity</div>
            <div className="card-subtitle">Latest verification logs from database</div>
          </div>
          <span className="live-badge"><span className="live-dot" />Live Supabase</span>
        </div>

        {loadingActivity ? (
          <div className="loading-spinner"><div className="spinner" /> Fetching logs…</div>
        ) : activity.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
              <Inbox size={32} color="#94A3B8" />
            </div>
            <p>No activity logs found in database.</p>
          </div>
        ) : (
          activity.map(act => {
            const isIn   = act.type === 'in';
            const isFail = ['EXPIRED','FAILED','REJECTED'].includes(act.status);
            const iconBg  = isFail ? '#FEE2E2' : isIn ? '#D1FAE5' : '#DBEAFE';
            const iconClr = isFail ? '#EF4444' : isIn ? '#10B981' : '#2563EB';

            return (
              <div key={act.id} className="activity-item">
                <div className="activity-icon" style={{ background: iconBg, color: iconClr, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isFail ? <AlertTriangle size={16} /> : isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{act.vehicle} · {act.customer}</div>
                  <div className="activity-sub">Code: <strong>{act.code}</strong> · Slot: <strong>{act.slot}</strong></div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className={`badge ${isFail ? 'badge-red' : isIn ? 'badge-green' : 'badge-blue'}`} style={{ marginBottom: 4, display: 'inline-block' }}>
                    {isFail ? 'Failed' : isIn ? 'Check In' : 'Check Out'}
                  </span>
                  <div className="activity-time">{act.date} · {act.time}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

