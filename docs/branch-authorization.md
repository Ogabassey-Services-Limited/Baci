# Branch Authorization Notes

Branches currently provide operational scoping for reporting, orders, expenses,
and payment accounts. Inventory remains merchant-wide until a future branch
inventory allocation model exists. Branches are not an authorization boundary.

Do not restrict staff to branches with client-side filtering. A future
authorization rollout must add a server-enforced model such as
`staff_branch_assignments(staff_member_id, branch_id, role, created_at)`, RLS
policies, and API checks before hiding or denying merchant data by branch.
