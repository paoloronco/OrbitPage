import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
} from 'lucide-react';
import { Info, Plus, Trash2, UsersRound, X } from '@/components/ui/material-icons';
import { useAppI18n } from '@/lib/i18n';
import { usersApi } from '@/lib/api-client';
import { isPasswordStrong } from '@/lib/auth';
import { DEMO_MODE } from '@/lib/config';
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, UserRole } from '@/lib/permissions';

interface User {
  username: string;
  created_at: string;
  role?: string;
}

type Msg = { type: 'success' | 'error'; text: string };

const PasswordFields = ({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => {
  const [show, setShow] = useState(false);
  return (
    <label className="team-field">
      <span>{label}</span>
      <div className="team-password-control">
        <Input
          aria-label={label}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="team-form-control pr-10"
          placeholder="Min 8 chars, upper/lower/number/symbol"
          required
          disabled={disabled}
        />
        <Button
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          type="button"
          variant="ghost"
          size="icon"
          className="team-password-toggle"
          onClick={() => setShow((v) => !v)}
          disabled={disabled}
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </label>
  );
};

const RoleSelect = ({
  value,
  onChange,
  disabled,
  excludeAdmin = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  excludeAdmin?: boolean;
}) => {
  const roleList = excludeAdmin ? ROLES.filter(r => r !== 'admin') : ROLES;
  return (
    <select
      aria-label="Role"
      className="team-form-control"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {roleList.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
    </select>
  );
};

export const UserManager = ({ currentUsername }: { currentUsername?: string }) => {
  const { tr, locale } = useAppI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalMsg, setGlobalMsg] = useState<Msg | null>(null);

  // Add-user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [newRole, setNewRole] = useState<string>('viewer');
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<Msg | null>(null);

  // Edit state: tracks which local user's password is being edited.
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editConfirm, setEditConfirm] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<Msg | null>(null);

  const demoMode = DEMO_MODE;

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      setGlobalMsg({ type: 'error', text: (err instanceof Error ? err.message : "") || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMsg(null);
    if (newPassword !== newConfirm) {
      setAddMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (!(await isPasswordStrong(newPassword))) {
      setAddMsg({ type: 'error', text: 'Password does not meet strength requirements' });
      return;
    }
    setAddLoading(true);
    try {
      await usersApi.create(newUsername, newPassword, newRole);
      setAddMsg({ type: 'success', text: `User "${newUsername}" created successfully` });
      setNewUsername('');
      setNewPassword('');
      setNewConfirm('');
      setNewRole('viewer');
      setShowAddForm(false);
      await fetchUsers();
    } catch (err) {
      setAddMsg({ type: 'error', text: (err instanceof Error ? err.message : "") || 'Failed to create user' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditPassword = async (e: React.FormEvent, username: string) => {
    e.preventDefault();
    setEditMsg(null);
    if (editPassword !== editConfirm) {
      setEditMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (!(await isPasswordStrong(editPassword))) {
      setEditMsg({ type: 'error', text: 'Password does not meet strength requirements' });
      return;
    }
    setEditLoading(true);
    try {
      await usersApi.changePassword(username, editPassword);
      setEditPassword('');
      setEditConfirm('');
      setEditingUser(null);
      setGlobalMsg({ type: 'success', text: `Password updated for "${username}"` });
    } catch (err) {
      setEditMsg({ type: 'error', text: (err instanceof Error ? err.message : "") || 'Failed to update password' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleRoleChange = async (username: string, role: string) => {
    const previousRole = users.find((user) => user.username === username)?.role;
    setGlobalMsg(null);
    setRoleUpdating(username);
    setUsers((current) => current.map((user) => user.username === username ? { ...user, role } : user));
    try {
      await usersApi.updateRole(username, role);
      setGlobalMsg({ type: 'success', text: `Role updated for "${username}"` });
      await fetchUsers();
    } catch (err) {
      setUsers((current) => current.map((user) => user.username === username ? { ...user, role: previousRole } : user));
      setGlobalMsg({ type: 'error', text: (err instanceof Error ? err.message : "") || 'Failed to update role' });
    } finally {
      setRoleUpdating(null);
    }
  };

  const handleDelete = async (username: string) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await usersApi.delete(username);
      setGlobalMsg({ type: 'success', text: `User "${username}" deleted` });
      await fetchUsers();
    } catch (err) {
      setGlobalMsg({ type: 'error', text: (err instanceof Error ? err.message : "") || 'Failed to delete user' });
    }
  };

  const openEdit = (username: string) => {
    setEditingUser(username);
    setEditPassword('');
    setEditConfirm('');
    setEditMsg(null);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditPassword('');
    setEditConfirm('');
    setEditMsg(null);
  };

  return (
    <section className="team-panel team-overview-panel">
      <div className="team-heading">
        <div>
          <p className="dashboard-kicker">Team</p>
          <div className="team-title-row">
            <h2>{tr("Workspace members", "Membri del workspace")}</h2>
            <span className="team-doc-help">
              <a aria-describedby="team-doc-tooltip" aria-label={tr("Teams and permissions in OrbitPage", "Team e permessi in OrbitPage")} className="team-doc-help-trigger" href="https://orbitpage.com/docs/team-and-permissions" rel="noreferrer" target="_blank"><Info aria-hidden="true" size={15} /></a>
              <span className="team-doc-tooltip" id="team-doc-tooltip" role="tooltip">{tr("Teams and permissions in OrbitPage", "Team e permessi in OrbitPage")}</span>
            </span>
          </div>
          <p className="muted">{tr("Add each person to this workspace. Everyone signs in with their own credentials and receives access based on their role.", "Aggiungi ogni persona a questo workspace. Ognuno accede con le proprie credenziali e riceve l'accesso previsto dal proprio ruolo.")}</p>
        </div>
        <UsersRound aria-hidden="true" size={24} />
      </div>

      <div className="team-toolbar">
        <p className="team-seat-summary">{users.length} {users.length === 1 ? tr("workspace member", "membro del workspace") : tr("workspace members", "membri del workspace")}</p>
        <button
          className="team-button secondary compact"
          onClick={() => {
            setShowAddForm((v) => !v);
            setAddMsg(null);
          }}
          type="button"
        >
          {showAddForm ? <X aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}
          {showAddForm ? tr("Cancel", "Annulla") : "Add user"}
        </button>
      </div>

      {globalMsg && (
        <div
          className={`team-feedback ${globalMsg.type}`}
        >
          {globalMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          {globalMsg.text}
        </div>
      )}

      {/* Add user form */}
      {showAddForm && (
        <form
          onSubmit={handleAddUser}
          className="team-user-form"
        >
          <label className="team-field" htmlFor="new-user-username">
            <span>Username</span>
            <Input
              id="new-user-username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="team-form-control"
              placeholder="3–32 characters (letters, numbers, _ -)"
              required
              disabled={addLoading}
              pattern="[a-zA-Z0-9_-]{3,32}"
              title="3–32 alphanumeric characters (underscores and hyphens allowed)"
            />
          </label>
          <label className="team-field">
            <span>Role</span>
            <RoleSelect value={newRole} onChange={setNewRole} disabled={addLoading} excludeAdmin />
          </label>
          <PasswordFields label="Password" value={newPassword} onChange={setNewPassword} disabled={addLoading} />
          <PasswordFields label="Confirm password" value={newConfirm} onChange={setNewConfirm} disabled={addLoading} />
          {addMsg && (
            <div
              className={`team-feedback ${addMsg.type}`}
            >
              {addMsg.type === 'success' ? (
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              {addMsg.text}
            </div>
          )}
          <div className="team-form-actions">
            <button aria-busy={addLoading} className="team-button primary" disabled={addLoading} type="submit">
              {addLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {addLoading ? 'Creating user' : 'Create user'}
            </button>
          </div>
        </form>
      )}
      {showAddForm && <p className="team-role-description">{ROLE_DESCRIPTIONS[newRole as UserRole]}</p>}

      {/* User list */}
      {loading ? (
        <div className="team-loading"><Loader2 aria-hidden="true" className="spin" size={18} />{tr("Loading collaborators", "Caricamento collaboratori")}</div>
      ) : (
        <ul className="team-member-list">
          {users.map((u) => {
            const isAdmin = u.username === 'admin';
            const isEditing = editingUser === u.username;
            const roleKey = (u.role || 'admin') as UserRole;
            const roleLabel = ROLE_LABELS[roleKey] || u.role || 'Admin';
            return (
              <li key={u.username} className="team-member-entry">
                <div className="team-member-row">
                  <span className="team-member-avatar" aria-hidden="true">{u.username.slice(0, 1)}</span>
                  <div className="team-member-identity">
                    <strong>{u.username}{u.username === currentUsername ? ` (${tr("you", "tu")})` : ''}</strong>
                    <span>Local account · created {new Date(u.created_at).toLocaleDateString(locale)}</span>
                  </div>
                  {isAdmin ? (
                    <span className={`team-role-badge ${roleKey}`}>{roleLabel}</span>
                  ) : (
                    <select
                      aria-label={`Role for ${u.username}`}
                      disabled={roleUpdating !== null}
                      onChange={(event) => void handleRoleChange(u.username, event.target.value)}
                      value={roleKey}
                    >
                      {ROLES.filter((role) => role !== 'admin').map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </select>
                  )}
                  {!demoMode && (
                    <div className="team-member-actions">
                      <button
                        aria-label="Change password"
                        className="team-member-password-button"
                        title="Change password"
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            cancelEdit();
                          } else {
                            openEdit(u.username);
                          }
                        }}
                      >
                        {isEditing ? (
                          <X className="w-3.5 h-3.5" />
                        ) : (
                          <Pencil className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {!isAdmin && <button aria-label={`Delete ${u.username}`} className="team-remove-button" onClick={() => handleDelete(u.username)} type="button"><Trash2 size={16} /></button>}
                    </div>
                  )}
                </div>

                {/* Inline edit panel */}
                {isEditing && (
                  <form
                    onSubmit={(e) => handleEditPassword(e, u.username)}
                    className="team-member-editor"
                  >
                    <p className="text-xs text-muted-foreground font-medium">Change password for "{u.username}"</p>
                    <PasswordFields label="New password" value={editPassword} onChange={setEditPassword} disabled={editLoading} />
                    <PasswordFields label="Confirm password" value={editConfirm} onChange={setEditConfirm} disabled={editLoading} />
                    {editMsg && (
                      <div
                        className={`team-feedback ${editMsg.type}`}
                      >
                        {editMsg.type === 'success' ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {editMsg.text}
                      </div>
                    )}
                    <div className="team-form-actions">
                      <button aria-busy={editLoading} type="submit" className="team-button primary" disabled={editLoading}>
                        {editLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {editLoading ? 'Saving password' : 'Save password'}
                      </button>
                      <button type="button" className="team-button secondary" onClick={cancelEdit} disabled={editLoading}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
