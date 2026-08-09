-- Add a third role, 'superadmin'. The first (bootstrapped) admin is a
-- superadmin: only a superadmin can change other users' roles, and a
-- superadmin can't be demoted or PIN-reset by a regular admin.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('resident', 'admin', 'superadmin'));
