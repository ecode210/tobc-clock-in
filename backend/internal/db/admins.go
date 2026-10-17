package db

import "context"

// Admin is a replicated cloud admin account. There is no local admin login.
type Admin struct {
	ID           string
	Username     string
	PasswordHash string
	IsSuper      bool
	CreatedAt    string
	UpdatedAt    string
}

// ReplaceAdmins replaces the whole admins table with the given list.
func ReplaceAdmins(ctx context.Context, q Querier, admins []Admin) error {
	if _, err := q.ExecContext(ctx, `DELETE FROM admins`); err != nil {
		return err
	}
	for _, a := range admins {
		if _, err := q.ExecContext(ctx, `INSERT INTO admins (id, username, password_hash, is_super, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			a.ID, a.Username, a.PasswordHash, boolInt(a.IsSuper), a.CreatedAt, a.UpdatedAt); err != nil {
			return err
		}
	}
	return nil
}

// ListAdmins returns all replicated admins.
func ListAdmins(ctx context.Context, q Querier) ([]Admin, error) {
	rows, err := q.QueryContext(ctx, `SELECT id, username, password_hash, is_super, created_at, updated_at FROM admins ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Admin
	for rows.Next() {
		var a Admin
		var super int
		if err := rows.Scan(&a.ID, &a.Username, &a.PasswordHash, &super, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.IsSuper = super != 0
		out = append(out, a)
	}
	return out, rows.Err()
}
