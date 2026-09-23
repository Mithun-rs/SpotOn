import React, { useState, useEffect } from 'react';
import { UserCheck, Search, CheckCircle2, Ban } from 'lucide-react';
import { supabase } from '../config/supabase';

export default function Users() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*, bookings(booking_id)')
        .order('created_at', { ascending: false });
      setUsers(data || []);
    } catch (e) {
      const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      setUsers(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const roles = [...new Set(users.map(u => u.role).filter(Boolean))];

  const filtered = users.filter(u => {
    const roleOk = filterRole === 'all' || u.role === filterRole;
    const q = search.toLowerCase();
    const searchOk = !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q);
    return roleOk && searchOk;
  });

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const ROLE_BADGE = {
    admin: 'badge-purple', staff: 'badge-blue', client: 'badge-green', user: 'badge-green',
  };

  const COLORS = ['#0052cc','#7C3AED','#10B981','#F59E0B','#EF4444','#06B6D4'];

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Users Directory</h1>
          <p>{users.length} registered users across all roles</p>
        </div>
      </div>

      {/* Role breakdown */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[{ label: 'Total', count: users.length, color: '#0052cc' },
          ...roles.map((r, i) => ({ label: r, count: users.filter(u => u.role === r).length, color: COLORS[i + 1] || '#94A3B8' }))
        ].map(c => (
          <div key={c.label} className="stat-card" style={{ '--card-accent': c.color, flex: 1, minWidth: 120 }}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ color: c.color, fontSize: 24 }}>{c.count}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center' }}><Search size={16} color="#94A3B8" /></span>
            <input className="form-input" placeholder="Search by name, email or phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {['all', ...roles].map(r => (
            <button key={r} className={`filter-pill${filterRole === r ? ' active' : ''}`} onClick={() => setFilterRole(r)}>
              {r === 'all' ? 'All Users' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><UserCheck size={32} color="#94A3B8" /></div>
            <p>No users found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Bookings</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.user_id || i}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0
                        }}>
                          {(u.full_name || u.email || 'U')[0].toUpperCase()}
                        </div>
                        <strong>{u.full_name || '—'}</strong>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.phone || '—'}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[u.role] || 'badge-gray'}`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, textAlign: 'center' }}>
                      {Array.isArray(u.bookings) ? u.bookings.length : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmt(u.created_at)}</td>
                    <td>
                      <span className={`badge ${u.is_active === false ? 'badge-red' : 'badge-green'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {u.is_active === false ? <><Ban size={12} /> Inactive</> : <><CheckCircle2 size={12} /> Active</>}
                      </span>
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

