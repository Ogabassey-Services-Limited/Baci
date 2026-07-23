WITH event_relations(schema_name,relation_name) AS (VALUES
  ('public','domain_event_failure_replays'),('public','domain_event_failures'),('public','domain_event_ledger'),('public','domain_event_producer_config'),
  ('public','event_deliveries'),('public','event_delivery_attempts'),('public','event_delivery_replays'),('public','event_pipeline_worker_heartbeats')
),
function_names(schema_name,function_name) AS (VALUES
  ('eventing','capture_order_domain_event_v1'),('eventing','capture_product_domain_event_v1'),('eventing','capture_transaction_domain_event_v1'),
  ('eventing','enqueue_domain_event_v1'),('eventing','finish_event_delivery_v1'),('eventing','is_event_pipeline_operator_v1'),
  ('eventing','resolve_domain_event_duplicate_v1'),('public','claim_event_deliveries_v1'),('public','cleanup_domain_event_pipeline_v1'),
  ('public','dead_letter_ingress_event_v1'),('public','enqueue_domain_event_v1'),('public','finish_event_delivery_v1'),
  ('public','get_domain_event_queue_metrics_v1'),('public','get_event_pipeline_operations_v1'),('public','is_event_ingress_capability_v1'),
  ('public','list_event_pipeline_deliveries_v1'),('public','list_event_pipeline_ingress_failures_v1'),('public','read_domain_events_v1'),
  ('public','record_analytics_domain_event_v1'),('public','record_event_worker_heartbeat_v1'),('public','record_platform_domain_event_v1'),
  ('public','replay_event_deliveries_batch_v1'),('public','replay_event_delivery_v1'),('public','replay_ingress_dead_letter_v1'),
  ('public','route_domain_event_v1'),('public','select_event_pipeline_replay_ids_v1'),('private','order_customer_cancellable'),
  ('private','restock_order_items'),('public','cancel_order_as_customer'),('public','customer_order_can_cancel'),
  ('public','prevent_cancelled_order_reopen'),('public','close_due_product_quiz_events'),('public','finalize_due_quiz_events'),
  ('public','mint_quiz_event_ranked_awards'),('public','register_push_token'),('public','storefront_merchant_has_paystack_subaccount')
),
selected_columns(schema_name,relation_name,column_name) AS (VALUES ('public','platform_events','event_id'),('public','orders','cancellation_reason'),('public','orders','cancelled_at'),('public','orders','cancelled_by'),('public','orders','delivered_at'),('public','orders','shipped_at')),
constraint_names(schema_name,relation_name,constraint_name) AS (VALUES ('public','orders','orders_cancelled_by_check'),('public','reconciliation_review','reconciliation_review_issue_type_check')),
index_names(schema_name,index_name) AS (VALUES ('public','analytics_events_merchant_event_id_type_uidx'),('public','platform_events_type_event_id_uidx')),
policy_names(schema_name,relation_name,policy_name) AS (VALUES
  ('public','analytics_events','Event ingress capability inserts analytics events'),('public','platform_events','Event ingress capability inserts platform events'),
  ('public','merchants','Anon can view merchants')),
trigger_names(schema_name,relation_name,trigger_name) AS (VALUES
  ('public','orders','capture_order_domain_event_v1'),('public','products','capture_product_domain_event_insert_delete_v1'),
  ('public','products','capture_product_domain_event_update_v1'),('public','transactions','capture_transaction_domain_event_v1'),('public','orders','prevent_cancelled_order_reopen')),
producer_keys(producer_key) AS (VALUES ('catalog.products'),('commerce.orders'),('payments.transactions')),
grant_relations(schema_name,relation_name) AS (VALUES ('public','merchants'),('public','merchant_feature_settings')),
extension_names(name,schema_name) AS (VALUES ('pgcrypto','extensions'),('pgmq','pgmq')),
pgmq_relation_names(relation_name) AS (VALUES ('a_domain_events'),('meta'),('q_domain_events')),
protected_roles(role_name) AS (VALUES ('PUBLIC'),('anon'),('authenticated'),('service_role')),
table_privileges(privilege) AS (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')),
schema_acl_rows AS (
  SELECT DISTINCT n.oid schema_oid,CASE x.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END grantee,
    x.privilege_type privilege,x.is_grantable grantable FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) x
),
relation_acl_rows AS (
  SELECT DISTINCT c.oid relation_oid,CASE x.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END grantee,
    x.privilege_type privilege,x.is_grantable grantable FROM pg_class c
    CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) x
),
column_acl_rows AS (
  SELECT DISTINCT a.attrelid relation_oid,a.attname column_name,CASE x.grantee WHEN 0 THEN 'PUBLIC'
    ELSE pg_get_userbyid(x.grantee) END grantee,x.privilege_type privilege,x.is_grantable grantable
    FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE a.attnum>0 AND NOT a.attisdropped
),
function_acl_rows AS (
  SELECT DISTINCT p.oid function_oid,CASE x.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END grantee,
    x.privilege_type privilege,x.is_grantable grantable FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) x
),
event_relation_components AS (
  SELECT 'event-relation'::text category,n.nspname||'.'||c.relname identity,
    jsonb_build_object(
      'owner',pg_get_userbyid(c.relowner),'kind',c.relkind::text,
      'partitionKey',CASE WHEN c.relkind='p' THEN pg_get_partkeydef(c.oid) END,
      'columns',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name',a.attname,'ordinal',a.attnum,'dataType',format_type(a.atttypid,a.atttypmod),
        'notNull',a.attnotnull,'identity',a.attidentity::text,'generated',a.attgenerated::text,
        'default',CASE WHEN d.oid IS NULL THEN NULL ELSE pg_get_expr(d.adbin,d.adrelid,true) END
      ) ORDER BY a.attnum),'[]'::jsonb) FROM pg_attribute a
        LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
        WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
      'constraints',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name',x.conname,'type',x.contype::text,'definition',pg_get_constraintdef(x.oid,true),
        'validated',x.convalidated
      ) ORDER BY x.conname),'[]'::jsonb) FROM pg_constraint x WHERE x.conrelid=c.oid),
      'indexes',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name',i.relname,'definition',pg_get_indexdef(ix.indexrelid,0,true),
        'valid',ix.indisvalid,'ready',ix.indisready,'live',ix.indislive
      ) ORDER BY i.relname),'[]'::jsonb) FROM pg_index ix
        JOIN pg_class i ON i.oid=ix.indexrelid WHERE ix.indrelid=c.oid),
      'rowLevelSecurity',jsonb_build_object('enabled',c.relrowsecurity,'forced',c.relforcerowsecurity),
      'policies',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name',p.polname,'command',p.polcmd::text,'permissive',p.polpermissive,
        'roles',(SELECT COALESCE(jsonb_agg(
          CASE role_oid WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid) END
          ORDER BY CASE role_oid WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid) END
        ),'[]'::jsonb) FROM unnest(p.polroles) role_oid),
        'qualifier',pg_get_expr(p.polqual,p.polrelid,true),
        'check',pg_get_expr(p.polwithcheck,p.polrelid,true)
      ) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid),
      'grants',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'objectKind',g.object_kind,'name',g.object_name,'grantee',g.grantee,
        'privilege',g.privilege,'grantable',g.grantable
      ) ORDER BY g.object_kind,g.object_name,g.grantee,g.privilege,g.grantable),'[]'::jsonb) FROM (
        SELECT 'relation' object_kind,c.relname object_name,
          x.grantee,x.privilege,x.grantable
        FROM relation_acl_rows x WHERE x.relation_oid=c.oid
        UNION ALL
        SELECT 'column',x.column_name,x.grantee,x.privilege,x.grantable
        FROM column_acl_rows x WHERE x.relation_oid=c.oid
      ) g)
    ) value
  FROM event_relations e JOIN pg_namespace n ON n.nspname=e.schema_name
  JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.relation_name
),
function_components AS (
  SELECT 'function'::text category,
    n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' identity,
    jsonb_build_object(
      'owner',pg_get_userbyid(p.proowner),'kind',p.prokind::text,
      'arguments',pg_get_function_arguments(p.oid),
      'identityArguments',pg_get_function_identity_arguments(p.oid),
      'result',CASE WHEN p.prokind='p' THEN 'procedure' ELSE pg_get_function_result(p.oid) END,
      'language',l.lanname,'volatility',p.provolatile::text,'parallel',p.proparallel::text,
      'securityDefiner',p.prosecdef,'leakproof',p.proleakproof,'strict',p.proisstrict,
      'returnsSet',p.proretset,'definition',pg_get_functiondef(p.oid),
      'config',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key',split_part(setting,'=',1),
        'value',substring(setting FROM position('=' IN setting)+1)
      ) ORDER BY split_part(setting,'=',1),setting),'[]'::jsonb)
        FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) setting),
      'executeGrants',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'grantee',x.grantee,'privilege',x.privilege,'grantable',x.grantable
      ) ORDER BY x.grantee,x.privilege,x.grantable),'[]'::jsonb)
        FROM function_acl_rows x WHERE x.function_oid=p.oid)
    ) value
  FROM function_names f JOIN pg_namespace n ON n.nspname=f.schema_name
  JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=f.function_name
  JOIN pg_language l ON l.oid=p.prolang WHERE p.prokind IN ('f','p')
),
selected_column_components AS (
  SELECT 'selected-column'::text category,
    n.nspname||'.'||c.relname||'.'||a.attname identity,
    jsonb_build_object(
      'dataType',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'identity',a.attidentity::text,'generated',a.attgenerated::text,
      'default',CASE WHEN d.oid IS NULL THEN NULL ELSE pg_get_expr(d.adbin,d.adrelid,true) END
    ) value
  FROM selected_columns s JOIN pg_namespace n ON n.nspname=s.schema_name
  JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=s.relation_name
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=s.column_name
    AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
),
constraint_components AS (
  SELECT 'constraint'::text category,
    n.nspname||'.'||c.relname||'.'||x.conname identity,
    jsonb_build_object('type',x.contype::text,'definition',pg_get_constraintdef(x.oid,true),
      'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred) value
  FROM constraint_names q JOIN pg_namespace n ON n.nspname=q.schema_name
  JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=q.relation_name
  JOIN pg_constraint x ON x.conrelid=c.oid AND x.conname=q.constraint_name
),
index_components AS (
  SELECT 'index'::text category,n.nspname||'.'||i.relname identity,
    jsonb_build_object('relation',r.relname,'definition',pg_get_indexdef(x.indexrelid,0,true),
      'valid',x.indisvalid,'ready',x.indisready,'live',x.indislive) value
  FROM index_names q JOIN pg_namespace n ON n.nspname=q.schema_name
  JOIN pg_class i ON i.relnamespace=n.oid AND i.relname=q.index_name
  JOIN pg_index x ON x.indexrelid=i.oid JOIN pg_class r ON r.oid=x.indrelid
),
policy_components AS (
  SELECT 'policy'::text category,n.nspname||'.'||c.relname||'.'||p.polname identity,
    jsonb_build_object('enabled',c.relrowsecurity,'forced',c.relforcerowsecurity,
      'command',p.polcmd::text,'permissive',p.polpermissive,
      'roles',(SELECT COALESCE(jsonb_agg(
        CASE role_oid WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid) END
        ORDER BY CASE role_oid WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid) END
      ),'[]'::jsonb) FROM unnest(p.polroles) role_oid),
      'qualifier',pg_get_expr(p.polqual,p.polrelid,true),
      'check',pg_get_expr(p.polwithcheck,p.polrelid,true)) value
  FROM policy_names q JOIN pg_namespace n ON n.nspname=q.schema_name
  JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=q.relation_name
  JOIN pg_policy p ON p.polrelid=c.oid AND p.polname=q.policy_name
),
trigger_components AS (
  SELECT 'trigger'::text category,n.nspname||'.'||c.relname||'.'||t.tgname identity,
    jsonb_build_object('enabled',t.tgenabled::text,'definition',pg_get_triggerdef(t.oid,true)) value
  FROM trigger_names q JOIN pg_namespace n ON n.nspname=q.schema_name
  JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=q.relation_name
  JOIN pg_trigger t ON t.tgrelid=c.oid AND t.tgname=q.trigger_name AND NOT t.tgisinternal
),
producer_components AS (
  SELECT 'producer-config'::text category,p.producer_key identity,
    jsonb_build_object('enabled',p.enabled,'shadowOnly',p.shadow_only) value
  FROM producer_keys q JOIN public.domain_event_producer_config p USING (producer_key)
),
relation_security_components AS (
  SELECT 'relation-security'::text category,n.nspname||'.'||c.relname identity,
    jsonb_build_object('owner',pg_get_userbyid(c.relowner),'enabled',c.relrowsecurity,
      'forced',c.relforcerowsecurity) value
  FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
  WHERE n.nspname='public' AND c.relname='merchants'
),
grant_vector_components AS (
  SELECT 'grant-vector'::text category,n.nspname||'.'||c.relname identity,
    jsonb_build_object(
      'tablePrivileges',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'role',x.grantee,'privilege',x.privilege,'grantable',x.grantable
      ) ORDER BY x.grantee,x.privilege,x.grantable),'[]'::jsonb)
        FROM relation_acl_rows x WHERE x.relation_oid=c.oid
          AND x.grantee IN ('PUBLIC','anon')),
      'columnPrivileges',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'column',x.column_name,'role',x.grantee,
        'privilege',x.privilege,'grantable',x.grantable
      ) ORDER BY x.column_name,x.grantee,x.privilege,x.grantable),'[]'::jsonb)
        FROM column_acl_rows x WHERE x.relation_oid=c.oid
          AND x.grantee IN ('PUBLIC','anon'))
    ) value
  FROM grant_relations q JOIN pg_namespace n ON n.nspname=q.schema_name
  JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=q.relation_name
),
extension_components AS (
  SELECT 'extension'::text category,n.nspname||'.'||e.extname identity,
    jsonb_build_object('name',e.extname,'schema',n.nspname) value
  FROM extension_names q JOIN pg_extension e ON e.extname=q.name
  JOIN pg_namespace n ON n.oid=e.extnamespace AND n.nspname=q.schema_name
),
pgmq_queue_components AS (
  SELECT 'pgmq-queue'::text category,'pgmq.domain_events'::text identity,
    jsonb_build_object(
      'meta',(SELECT jsonb_build_object('present',true,'isPartitioned',m.is_partitioned,
        'isUnlogged',m.is_unlogged) FROM pgmq.meta m WHERE m.queue_name='domain_events'),
      'relations',(SELECT jsonb_agg(jsonb_build_object(
        'name',q.relation_name,'present',c.oid IS NOT NULL,
        'owner',CASE WHEN c.oid IS NULL THEN NULL ELSE pg_get_userbyid(c.relowner) END,
        'kind',c.relkind::text,
        'columns',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name',a.attname,'ordinal',a.attnum,'dataType',format_type(a.atttypid,a.atttypmod),
          'notNull',a.attnotnull,'identity',a.attidentity::text,'generated',a.attgenerated::text,
          'default',CASE WHEN d.oid IS NULL THEN NULL ELSE pg_get_expr(d.adbin,d.adrelid,true) END
        ) ORDER BY a.attnum),'[]'::jsonb) FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
          WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
        'constraints',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name',x.conname,'type',x.contype::text,'definition',pg_get_constraintdef(x.oid,true),
          'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred
        ) ORDER BY x.conname),'[]'::jsonb) FROM pg_constraint x WHERE x.conrelid=c.oid),
        'indexes',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name',i.relname,'definition',pg_get_indexdef(ix.indexrelid,0,true),
          'valid',ix.indisvalid,'ready',ix.indisready,'live',ix.indislive
        ) ORDER BY i.relname),'[]'::jsonb) FROM pg_index ix
          JOIN pg_class i ON i.oid=ix.indexrelid WHERE ix.indrelid=c.oid)
      ) ORDER BY q.relation_name) FROM pgmq_relation_names q
        LEFT JOIN pg_namespace n ON n.nspname='pgmq'
        LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=q.relation_name)
    ) value
),
pgmq_access_components AS (
  SELECT 'pgmq-access'::text category,'pgmq.'||r.role_name identity,jsonb_build_object(
      'rolePresent',r.role_name='PUBLIC' OR EXISTS(SELECT 1 FROM pg_roles pr WHERE pr.rolname=r.role_name),
      'schemaPrivileges',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'privilege',x.privilege,'grantable',x.grantable) ORDER BY x.privilege,x.grantable),'[]'::jsonb)
        FROM pg_namespace n JOIN schema_acl_rows x ON x.schema_oid=n.oid
        WHERE n.nspname='pgmq' AND x.grantee=r.role_name),
      'tablePrivileges',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'relation',c.relname,'privilege',x.privilege,'grantable',x.grantable)
        ORDER BY c.relname,x.privilege,x.grantable),'[]'::jsonb) FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace JOIN relation_acl_rows x ON x.relation_oid=c.oid
        WHERE n.nspname='pgmq' AND c.relname IN ('meta','q_domain_events','a_domain_events')
          AND x.grantee=r.role_name),
      'executeFunctions',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'identity',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','grantable',x.grantable
      ) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid),x.grantable),'[]'::jsonb)
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN function_acl_rows x ON x.function_oid=p.oid
        WHERE n.nspname='pgmq' AND x.privilege='EXECUTE' AND x.grantee=r.role_name),
      'effectiveSchemaUsage',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(
        SELECT 1 FROM pg_namespace n JOIN schema_acl_rows x ON x.schema_oid=n.oid
        WHERE n.nspname='pgmq' AND x.grantee='PUBLIC' AND x.privilege='USAGE') ELSE has_schema_privilege(r.role_name,'pgmq','USAGE') END,
      'effectiveTablePrivileges',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'relation',c.relname,'privilege',v.privilege) ORDER BY c.relname,v.privilege),'[]'::jsonb)
        FROM pgmq_relation_names q JOIN pg_namespace n ON n.nspname='pgmq'
        JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=q.relation_name CROSS JOIN table_privileges v
        WHERE CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM relation_acl_rows x
          WHERE x.relation_oid=c.oid AND x.grantee='PUBLIC' AND x.privilege=v.privilege)
          ELSE has_table_privilege(r.role_name,c.oid,v.privilege) END),
      'effectiveExecuteFunctions',(SELECT COALESCE(jsonb_agg(
        n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
        ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='pgmq' AND CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1
          FROM function_acl_rows x WHERE x.function_oid=p.oid AND x.grantee='PUBLIC' AND x.privilege='EXECUTE')
          ELSE has_function_privilege(r.role_name,p.oid,'EXECUTE') END)
    ) value FROM protected_roles r
),
schema_presence_components AS (
  SELECT 'schema-presence'::text category,'pgmq_public'::text identity,jsonb_build_object(
    'present',EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='pgmq_public')) value
),
components AS (
  SELECT * FROM event_relation_components UNION ALL SELECT * FROM function_components UNION ALL SELECT * FROM selected_column_components
  UNION ALL SELECT * FROM constraint_components UNION ALL SELECT * FROM index_components UNION ALL SELECT * FROM policy_components
  UNION ALL SELECT * FROM trigger_components UNION ALL SELECT * FROM producer_components UNION ALL SELECT * FROM relation_security_components
  UNION ALL SELECT * FROM grant_vector_components UNION ALL SELECT * FROM extension_components UNION ALL SELECT * FROM pgmq_queue_components
  UNION ALL SELECT * FROM pgmq_access_components UNION ALL SELECT * FROM schema_presence_components
)
SELECT jsonb_build_object(
  'scopeVersion','baci-p0-effects-v3','serverVersionNum',current_setting('server_version_num')::int,
  'components',COALESCE(jsonb_agg(jsonb_build_object('category',category,'identity',identity,'value',value)
    ORDER BY category,identity),'[]'::jsonb),
  'diagnostics',jsonb_build_object(
    'extensionVersions',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name',e.extname,'schema',n.nspname,'version',e.extversion) ORDER BY e.extname,n.nspname),'[]'::jsonb)
      FROM extension_names q JOIN pg_extension e ON e.extname=q.name JOIN pg_namespace n ON n.oid=e.extnamespace AND n.nspname=q.schema_name))
) snapshot FROM components;
