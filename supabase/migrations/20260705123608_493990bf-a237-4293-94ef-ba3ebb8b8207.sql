
-- Enable RLS on realtime.messages (idempotent)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zx_realtime_scope_by_topic" ON realtime.messages;

CREATE POLICY "zx_realtime_scope_by_topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR realtime.topic() = ('notifs-' || auth.uid()::text)
  OR realtime.topic() = ('buyer-orders-' || auth.uid()::text)
  OR realtime.topic() = ('seller-orders-' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'order-%'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = substring(realtime.topic() from 7)
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  )
);
