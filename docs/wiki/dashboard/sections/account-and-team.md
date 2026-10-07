# Account and team

![Team members and Account instance settings](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-account-and-team-4.21.75.gif)

Manage local accounts under **Team** and your own security under **Account → Security**. Available tools depend on your role.

## Add or change a local user

1. Sign in as the installation administrator and open **Team**.
2. Select **Add user**, enter a 3–32 character username (letters, numbers,
   underscores and hyphens), choose a non-admin role, and enter and confirm a
   strong password.
3. Select **Create user** and verify the result in the member list.
4. Give the person their own credentials through a protected channel. They
   sign in to this installation and configure their own authenticator.

The role selector saves a role change immediately. Use the pencil action to
replace a user's password, or Delete and its confirmation to remove a user.
Deletion cannot be undone. The first `admin` account cannot be deleted or reassigned; new users receive non-admin roles.
Changing roles also changes the permissions of existing personal API tokens.

## Password and two-factor authentication

Open **Account → Security** for the signed-in user's password and authenticator.
For password changes, enter the current password, then the new password and its
confirmation. Use a unique password that passes the on-screen strength checks.

To enable TOTP:

1. Enter the current password and select **Set up authenticator**.
2. Scan the QR with a TOTP app, or enter the displayed key manually.
3. Enter its six-digit code before the setup expires and select **Verify and enable**.
4. Save the one-time recovery codes immediately in a password manager; they
   are displayed only at creation. Use one at sign-in if the authenticator is unavailable.

**Replace recovery codes** needs the current password and an authentication or
recovery code; replacement invalidates the previous set. **Disable 2FA** needs
the same checks and confirmation and revokes older sessions. If all access is
lost, follow the host-owner recovery procedure in [Security](../../Security.md).
Never send setup keys or recovery codes in support requests.

## Personal API tokens

Open **Team → Personal API tokens**, give the token a recognizable name, choose
Full, Read-only or Links-only access and an expiry (30, 90, 365 days or never),
then confirm with the current password. Copy the token immediately: the secret
is shown only once. Keep it in a secret store and send it only as an HTTPS bearer
credential. There can be at most ten active tokens per local account.

Full access remains bounded by the account's current role and never permits
user management. Read-only and Links-only further narrow it. Revoke a token
from the same panel when it is no longer needed or might be exposed; deleting
the account also deletes its tokens. See [the API guide](../../api.md) for the
request example and supported automation boundaries.

## Audit and instance operations

Administrators can filter **Account → Audit log** by text, actor, action and
date. It records successful authenticated changes as metadata, not a copy of
page contents. Records stay in SQLite and are included in infrastructure backups;
recording starts when the feature is installed.

**Account → General** exposes version, instance checks and update actions.
See [Deployment](../../Deployment.md#update-safely) for updates and [Maintenance](../../maintenance.md) for backup, rollback, and removal,
and [Configuration](../../Configuration.md#dashboard-environment-overrides) before
changing runtime environment overrides. Restart after saving environment overrides.
