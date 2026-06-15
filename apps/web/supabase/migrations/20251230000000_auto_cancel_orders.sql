-- Function to mark old unpaid orders as cancelled/abandoned
create or replace function mark_abandoned_orders(hours_threshold int default 72)
returns void
language plpgsql
security definer
as $$
begin
  -- Update orders that are 'unpaid' and older than the threshold
  -- We set payment_status to 'cancelled' to indicate system auto-cancellation
  update orders
  set payment_status = 'cancelled',
      updated_at = now()
  where payment_status = 'unpaid'
  and created_at < (now() - (hours_threshold || ' hours')::interval);

  -- Log the cleanup action (optional but good practice implies we might want to log somewhere,
  -- but for now keeping it simple and just doing the update)
end;
$$;
