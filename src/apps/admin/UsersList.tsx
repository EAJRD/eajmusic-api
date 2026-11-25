import React, { useState } from 'react';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'ARTIST' | 'LABEL' | 'ADMIN';
  plan: 'FREE' | 'PRO_ARTIST' | 'LABEL_PLUS';
  athMovilPhone?: string;
  isAthVerified: boolean;
  registeredDate: string;
  releasesCount: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

const INITIAL_USERS: UserItem[] = [
  {
    id: 'usr_001',
    name: 'Kaelo',
    email: 'kaelo@eajmusic.com',
    role: 'ARTIST',
    plan: 'PRO_ARTIST',
    athMovilPhone: '+1 (787) 555-0192',
    isAthVerified: true,
    registeredDate: '2026-08-10',
    releasesCount: 2,
    status: 'ACTIVE'
  },
  {
    id: 'usr_002',
    name: 'Vlady Santos',
    email: 'vlady@eajmusic.com',
    role: 'ARTIST',
    plan: 'LABEL_PLUS',
    athMovilPhone: '+1 (939) 442-8811',
    isAthVerified: true,
    registeredDate: '2026-07-22',
    releasesCount: 3,
    status: 'ACTIVE'
  },
  {
    id: 'usr_003',
    name: 'Isla Sintética Records',
    email: 'contacto@islasintetica.com',
    role: 'LABEL',
    plan: 'LABEL_PLUS',
    athMovilPhone: '+1 (787) 321-9988',
    isAthVerified: true,
    registeredDate: '2026-09-01',
    releasesCount: 5,
    status: 'ACTIVE'
  },
  {
    id: 'usr_004',
    name: 'Ernesto / Dirección General',
    email: 'ceo@empireanimationsjoyful.com',
    role: 'ADMIN',
    plan: 'LABEL_PLUS',
    athMovilPhone: '+1 (787) 999-0000',
    isAthVerified: true,
    registeredDate: '2026-01-01',
    releasesCount: 12,
    status: 'ACTIVE'
  },
  {
    id: 'usr_005',
    name: 'Niko PR',
    email: 'niko@demo.pr',
    role: 'ARTIST',
    plan: 'FREE',
    athMovilPhone: '+1 (787) 412-3344',
    isAthVerified: false,
    registeredDate: '2026-10-30',
    releasesCount: 1,
    status: 'ACTIVE'
  }
];

export const UsersList: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>(INITIAL_USERS);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ARTIST' | 'LABEL' | 'ADMIN'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const toggleStatus = (id: string) => {
    setUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : u))
    );
  };

  const changeRole = (id: string, newRole: 'ARTIST' | 'LABEL' | 'ADMIN') => {
    setUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, role: newRole } : u))
    );
  };

  const filtered = users.filter(u => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div style={{ background: '#121217', borderRadius: 16, padding: '1.75rem', border: '1px solid #23232f' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>Gestión de Artistas, Sellos y Administradores</h2>
          <p style={{ color: '#9292a0', fontSize: '0.85rem' }}>Administra roles, verificación de cuentas ATH Móvil y estado de suscripción de la plataforma.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              background: '#0d0d12',
              border: '1px solid #242432',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              fontSize: '0.82rem',
              minWidth: 230
            }}
          />

          {(['ALL', 'ARTIST', 'LABEL', 'ADMIN'] as const).map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              style={{
                background: roleFilter === role ? 'rgba(229, 179, 88, 0.15)' : '#1a1a24',
                color: roleFilter === role ? '#e5b358' : '#9292a0',
                border: roleFilter === role ? '1px solid #e5b358' : '1px solid #242432',
                padding: '0.45rem 0.9rem',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {role === 'ALL' ? 'Todos' : role === 'ARTIST' ? 'Artistas' : role === 'LABEL' ? 'Sellos' : 'Admins'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #23232f', color: '#9292a0', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Usuario / Artista</th>
              <th style={{ padding: '0.75rem 1rem' }}>Rol</th>
              <th style={{ padding: '0.75rem 1rem' }}>Plan Activo</th>
              <th style={{ padding: '0.75rem 1rem' }}>ATH Móvil (PR)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Lanzamientos</th>
              <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
              <th style={{ padding: '0.75rem 1rem' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9292a0' }}>{user.email}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 12,
                      background: user.role === 'ADMIN' ? 'rgba(229, 179, 88, 0.15)' : user.role === 'LABEL' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: user.role === 'ADMIN' ? '#e5b358' : user.role === 'LABEL' ? '#38bdf8' : '#22c55e',
                      border: `1px solid ${user.role === 'ADMIN' ? '#e5b358' : user.role === 'LABEL' ? '#38bdf8' : '#22c55e'}`
                    }}
                  >
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '1rem', color: '#e5b358', fontWeight: 600 }}>
                  {user.plan === 'PRO_ARTIST' ? 'Pro Artist ($19.99)' : user.plan === 'LABEL_PLUS' ? 'Label Plus ($49.99)' : 'Free ($0)'}
                </td>
                <td style={{ padding: '1rem' }}>
                  {user.athMovilPhone ? (
                    <div>
                      <span style={{ fontFamily: 'monospace', color: '#ff5000' }}>{user.athMovilPhone}</span>
                      {user.isAthVerified ? (
                        <span style={{ color: '#22c55e', fontSize: '0.72rem', marginLeft: '0.4rem' }}>✓ Verificado</span>
                      ) : (
                        <span style={{ color: '#e5b358', fontSize: '0.72rem', marginLeft: '0.4rem' }}>⏳ Pendiente</span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#68687a', fontSize: '0.8rem' }}>Sin vincular</span>
                  )}
                </td>
                <td style={{ padding: '1rem', fontWeight: 700, color: '#fff' }}>
                  {user.releasesCount}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: 10,
                      background: user.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: user.status === 'ACTIVE' ? '#22c55e' : '#ef4444'
                    }}
                  >
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <button
                      onClick={() => toggleStatus(user.id)}
                      style={{
                        background: '#1a1a24',
                        color: user.status === 'ACTIVE' ? '#ef4444' : '#22c55e',
                        border: '1px solid #333',
                        padding: '0.35rem 0.65rem',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      {user.status === 'ACTIVE' ? 'Suspender' : 'Activar'}
                    </button>
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => changeRole(user.id, user.role === 'ARTIST' ? 'LABEL' : 'ARTIST')}
                        style={{
                          background: '#1a1a24',
                          color: '#e5b358',
                          border: '1px solid #333',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cambiar a {user.role === 'ARTIST' ? 'Sello' : 'Artista'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersList;
