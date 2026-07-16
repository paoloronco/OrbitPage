import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
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
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="glass-card border-primary/20 pr-10 text-sm"
          placeholder="Min 8 chars, upper/lower/number/symbol"
          required
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShow((v) => !v)}
          disabled={disabled}
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
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
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="glass-card border-primary/20 text-sm h-9">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {roleList.map((role) => (
          <SelectItem key={role} value={role}>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{ROLE_LABELS[role]}</span>
              <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const roleBadgeClass: Record<string, string> = {
  admin:        'bg-primary/15 text-primary',
  editor:       'bg-blue-500/15 text-blue-600',
  links_editor: 'bg-cyan-500/15 text-cyan-700',
  links_style:  'bg-violet-500/15 text-violet-700',
  links_images: 'bg-pink-500/15 text-pink-700',
  theme_editor: 'bg-amber-500/15 text-amber-700',
  compliance:   'bg-emerald-500/15 text-emerald-700',
  viewer:       'bg-slate-400/20 text-slate-600',
};

export const UserManager = () => {
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

  // Edit state: tracks which username is being edited (password or role)
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'password' | 'role'>('password');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirm, setEditConfirm] = useState('');
  const [editRole, setEditRole] = useState<string>('viewer');
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<Msg | null>(null);

  const demoMode = DEMO_MODE;

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err: any) {
      setGlobalMsg({ type: 'error', text: err?.message || 'Failed to load users' });
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
    } catch (err: any) {
      setAddMsg({ type: 'error', text: err?.message || 'Failed to create user' });
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
    } catch (err: any) {
      setEditMsg({ type: 'error', text: err?.message || 'Failed to update password' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveRole = async (e: React.FormEvent, username: string) => {
    e.preventDefault();
    setEditMsg(null);
    setEditLoading(true);
    try {
      await usersApi.updateRole(username, editRole);
      setEditingUser(null);
      setGlobalMsg({ type: 'success', text: `Role updated for "${username}"` });
      await fetchUsers();
    } catch (err: any) {
      setEditMsg({ type: 'error', text: err?.message || 'Failed to update role' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await usersApi.delete(username);
      setGlobalMsg({ type: 'success', text: `User "${username}" deleted` });
      await fetchUsers();
    } catch (err: any) {
      setGlobalMsg({ type: 'error', text: err?.message || 'Failed to delete user' });
    }
  };

  const openEdit = (username: string, mode: 'password' | 'role', currentRole?: string) => {
    setEditingUser(username);
    setEditMode(mode);
    setEditPassword('');
    setEditConfirm('');
    setEditRole(currentRole || 'viewer');
    setEditMsg(null);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditPassword('');
    setEditConfirm('');
    setEditMsg(null);
  };

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold gradient-text">Users</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => {
            setShowAddForm((v) => !v);
            setAddMsg(null);
          }}
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAddForm ? 'Cancel' : 'Add user'}
        </Button>
      </div>

      {globalMsg && (
        <div
          className={`text-sm p-3 rounded-lg flex items-center gap-2 ${
            globalMsg.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
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
          className="border border-primary/20 rounded-lg p-4 space-y-3 bg-primary/5"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New user</p>
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="glass-card border-primary/20 text-sm"
              placeholder="3–32 characters (letters, numbers, _ -)"
              required
              disabled={addLoading}
              pattern="[a-zA-Z0-9_-]{3,32}"
              title="3–32 alphanumeric characters (underscores and hyphens allowed)"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <RoleSelect value={newRole} onChange={setNewRole} disabled={addLoading} excludeAdmin />
          </div>
          <PasswordFields label="Password" value={newPassword} onChange={setNewPassword} disabled={addLoading} />
          <PasswordFields label="Confirm password" value={newConfirm} onChange={setNewConfirm} disabled={addLoading} />
          {addMsg && (
            <div
              className={`text-xs p-2 rounded flex items-center gap-1.5 ${
                addMsg.type === 'success'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {addMsg.type === 'success' ? (
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              {addMsg.text}
            </div>
          )}
          <Button aria-busy={addLoading} type="submit" variant="gradient" size="sm" className="w-full" disabled={addLoading}>
            {addLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {addLoading ? 'Creating user' : 'Create user'}
          </Button>
        </form>
      )}

      {/* User list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const isAdmin = u.username === 'admin';
            const isEditing = editingUser === u.username;
            const roleKey = (u.role || 'admin') as UserRole;
            const roleLabel = ROLE_LABELS[roleKey] || u.role || 'Admin';
            const badgeClass = roleBadgeClass[roleKey] || roleBadgeClass.viewer;
            return (
              <li key={u.username} className="border border-primary/10 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-primary/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className={`w-4 h-4 shrink-0 ${isAdmin ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium truncate">{u.username}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                      {roleLabel}
                    </span>
                  </div>
                  {!demoMode && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {!isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Change role"
                          onClick={() => {
                            if (isEditing && editMode === 'role') {
                              cancelEdit();
                            } else {
                              openEdit(u.username, 'role', u.role);
                            }
                          }}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Change password"
                        onClick={() => {
                          if (isEditing && editMode === 'password') {
                            cancelEdit();
                          } else {
                            openEdit(u.username, 'password', u.role);
                          }
                        }}
                      >
                        {isEditing && editMode === 'password' ? (
                          <X className="w-3.5 h-3.5" />
                        ) : (
                          <Pencil className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title={isAdmin ? 'The admin user cannot be deleted' : 'Delete user'}
                        disabled={isAdmin}
                        onClick={() => handleDelete(u.username)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Inline edit panel */}
                {isEditing && editMode === 'password' && (
                  <form
                    onSubmit={(e) => handleEditPassword(e, u.username)}
                    className="px-3 py-3 space-y-2 border-t border-primary/10 bg-background/40"
                  >
                    <p className="text-xs text-muted-foreground font-medium">Change password for "{u.username}"</p>
                    <PasswordFields label="New password" value={editPassword} onChange={setEditPassword} disabled={editLoading} />
                    <PasswordFields label="Confirm password" value={editConfirm} onChange={setEditConfirm} disabled={editLoading} />
                    {editMsg && (
                      <div
                        className={`text-xs p-2 rounded flex items-center gap-1.5 ${
                          editMsg.type === 'success'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {editMsg.type === 'success' ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {editMsg.text}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button aria-busy={editLoading} type="submit" variant="gradient" size="sm" className="flex-1" disabled={editLoading}>
                        {editLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {editLoading ? 'Saving password' : 'Save password'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={editLoading}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {isEditing && editMode === 'role' && (
                  <form
                    onSubmit={(e) => handleSaveRole(e, u.username)}
                    className="px-3 py-3 space-y-2 border-t border-primary/10 bg-background/40"
                  >
                    <p className="text-xs text-muted-foreground font-medium">Change role for "{u.username}"</p>
                    <div className="space-y-1">
                      <Label className="text-xs">Role</Label>
                      <RoleSelect value={editRole} onChange={setEditRole} disabled={editLoading} excludeAdmin />
                    </div>
                    {editMsg && (
                      <div
                        className={`text-xs p-2 rounded flex items-center gap-1.5 ${
                          editMsg.type === 'success'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {editMsg.type === 'success' ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {editMsg.text}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button aria-busy={editLoading} type="submit" variant="gradient" size="sm" className="flex-1" disabled={editLoading}>
                        {editLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {editLoading ? 'Saving role' : 'Save role'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={editLoading}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
