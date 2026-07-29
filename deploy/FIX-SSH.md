# Fix SSH key auth for GitHub Actions (VPS side)

Your PC key is valid. Debug showed the server **rejects** the offered key.
That is almost always `authorized_keys` permissions / format on the VPS.

## On VPS (login with password)

Paste this whole block:

```bash
mkdir -p /root/.ssh
chmod 700 /root /root/.ssh

# Write ONLY this deploy key (clean file — removes broken/duplicate lines)
cat > /root/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGUWAxjjR/N/sZxpWbjNz6LbBn/iiUkvuQzqx8sHJM4q stampogen-github-actions
EOF

chmod 600 /root/.ssh/authorized_keys
chown -R root:root /root/.ssh

# Verify fingerprint (must match PC: SHA256:QLoFr2MPPnmOOJdB78UMLjAL4O2S8MNDjKdJ28PKyJY)
ssh-keygen -lf /root/.ssh/authorized_keys

# Show what sshd actually uses
sshd -T | grep -Ei 'pubkeyauthentication|authorizedkeysfile|permitrootlogin|strictmodes'

# Make sure home is not group/world writable (StrictModes)
ls -ld /root /root/.ssh /root/.ssh/authorized_keys

systemctl reload ssh 2>/dev/null || systemctl reload sshd
```

Expected fingerprint line:

```text
256 SHA256:QLoFr2MPPnmOOJdB78UMLjAL4O2S8MNDjKdJ28PKyJY stampogen-github-actions (ED25519)
```

If `/root` shows permissions like `drwxrwxr-x` or world-writable, fix:

```bash
chmod 755 /root
```

## On PC (PowerShell)

```powershell
ssh -i .\stampogen_gha -o IdentitiesOnly=yes -o PreferredAuthentications=publickey root@200.97.169.26 "echo OK"
```

Must print `OK` with **no password prompt**.

Then update GitHub secret `VPS_SSH_PRIVATE_KEY` with the full contents of `E:\Stampogen\stampogen_gha` and re-run Actions.
