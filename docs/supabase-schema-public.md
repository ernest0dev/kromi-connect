## Table `campanas`

### Columns

| Name                    | Type                | Constraints |
| ----------------------- | ------------------- | ----------- |
| `id`                    | `uuid`              | Primary     |
| `nombre`                | `text`              |             |
| `tipo_campana`          | `tipo_campana_enum` |             |
| `fecha_inicio`          | `date`              |             |
| `fecha_fin`             | `date`              |             |
| `activo`                | `bool`              | Nullable    |
| `created_at`            | `timestamptz`       | Nullable    |
| `descripcion`           | `text`              | Nullable    |
| `presupuesto`           | `numeric`           | Nullable    |
| `estatus`               | `text`              |             |
| `estatus_pre_archivado` | `text`              | Nullable    |

## Table `publicaciones`

### Columns

| Name                            | Type           | Constraints |
| ------------------------------- | -------------- | ----------- |
| `id`                            | `uuid`         | Primary     |
| `campana_id`                    | `uuid`         | Nullable    |
| `titulo`                        | `text`         |             |
| `formato`                       | `formato_enum` |             |
| `linea_contenido`               | `text`         | Nullable    |
| `fecha_publicacion`             | `date`         |             |
| `fecha_limite_brief`            | `date`         | Nullable    |
| `fecha_solicitud_diseno`        | `timestamptz`  | Nullable    |
| `fecha_entrega_diseno_estimada` | `date`         | Nullable    |
| `fecha_entrega_diseno_real`     | `timestamptz`  | Nullable    |
| `fecha_aprobacion_gerencia`     | `timestamptz`  | Nullable    |
| `estatus`                       | `estatus_enum` |             |
| `hook_texto`                    | `text`         | Nullable    |
| `body_texto`                    | `text`         | Nullable    |
| `cta_texto`                     | `text`         | Nullable    |
| `hashtags`                      | `_text`        | Nullable    |
| `version_copy`                  | `int4`         | Nullable    |
| `drive_folder_id`               | `text`         | Nullable    |
| `drive_folder_url`              | `text`         | Nullable    |
| `creador_id`                    | `uuid`         | Nullable    |
| `disenador_id`                  | `uuid`         | Nullable    |
| `created_at`                    | `timestamptz`  | Nullable    |
| `updated_at`                    | `timestamptz`  | Nullable    |
| `deleted_at`                    | `timestamptz`  | Nullable    |
| `hora_publicacion`              | `time`         | Nullable    |
| `requiere_rodaje`               | `bool`         |             |
| `fecha_rodaje`                  | `date`         | Nullable    |
| `sedes`                         | `_sede_enum`   |             |
| `prioridad`                     | `int2`         |             |
| `drive_cleanup_status`          | `text`         |             |
| `drive_cleanup_error`           | `text`         | Nullable    |
| `drive_cleanup_attempted_at`    | `timestamptz`  | Nullable    |
| `drive_deleted_at`              | `timestamptz`  | Nullable    |
| `drive_preserved_at`            | `timestamptz`  | Nullable    |
| `drive_brief_folder_id`         | `text`         | Nullable    |
| `drive_deliverables_folder_id`  | `text`         | Nullable    |
| `drive_brief_file_count`        | `int4`         |             |
| `drive_brief_checked_at`        | `timestamptz`  | Nullable    |
| `requiere_diseno`               | `bool`         |             |

## Table `publicacion_canales`

### Columns

| Name                 | Type         | Constraints |
| -------------------- | ------------ | ----------- |
| `id`                 | `uuid`       | Primary     |
| `publicacion_id`     | `uuid`       |             |
| `canal`              | `canal_enum` |             |
| `estado_publicacion` | `text`       | Nullable    |
| `url_publicacion`    | `text`       | Nullable    |
| `social_account_id`  | `uuid`       | Nullable    |

## Table `checklist_rodaje`

### Columns

| Name             | Type          | Constraints |
| ---------------- | ------------- | ----------- |
| `id`             | `uuid`        | Primary     |
| `publicacion_id` | `uuid`        |             |
| `toma_requerida` | `text`        |             |
| `area_tienda`    | `text`        |             |
| `sucursal`       | `sede_enum`   |             |
| `completado`     | `bool`        | Nullable    |
| `created_at`     | `timestamptz` | Nullable    |

## Table `solicitudes_terceros`

### Columns

| Name                      | Type                | Constraints |
| ------------------------- | ------------------- | ----------- |
| `id`                      | `uuid`              | Primary     |
| `departamento_emisor`     | `departamento_enum` |             |
| `tipo_solicitud`          | `text`              |             |
| `descripcion`             | `text`              | Nullable    |
| `materiales_adjuntos_url` | `_text`             | Nullable    |
| `estatus_solicitud`       | `text`              | Nullable    |
| `publicacion_id`          | `uuid`              | Nullable    |
| `created_at`              | `timestamptz`       | Nullable    |

## Table `inventario_premios`

### Columns

| Name                 | Type          | Constraints |
| -------------------- | ------------- | ----------- |
| `id`                 | `uuid`        | Primary     |
| `proveedor_nombre`   | `text`        | Nullable    |
| `nombre_premio`      | `text`        |             |
| `cantidad_recibida`  | `int4`        | Nullable    |
| `cantidad_entregada` | `int4`        | Nullable    |
| `sucursal_ubicacion` | `sede_enum`   |             |
| `campana_id`         | `uuid`        | Nullable    |
| `solicitud_id`       | `uuid`        | Nullable    |
| `estado_premio`      | `text`        | Nullable    |
| `created_at`         | `timestamptz` | Nullable    |

## Table `reporte_atencion_cliente`

### Columns

| Name                 | Type          | Constraints |
| -------------------- | ------------- | ----------- |
| `id`                 | `uuid`        | Primary     |
| `fecha_semana`       | `date`        |             |
| `canal`              | `canal_enum`  |             |
| `tipo`               | `text`        |             |
| `categoria`          | `text`        | Nullable    |
| `detalle_comentario` | `text`        | Nullable    |
| `accion_tomada`      | `text`        | Nullable    |
| `status`             | `text`        | Nullable    |
| `created_at`         | `timestamptz` | Nullable    |

## Table `campana_evaluaciones`

### Columns

| Name                    | Type          | Constraints |
| ----------------------- | ------------- | ----------- |
| `id`                    | `uuid`        | Primary     |
| `campana_id`            | `uuid`        |             |
| `alcance_total`         | `int8`        | Nullable    |
| `interacciones_totales` | `int8`        | Nullable    |
| `presupuesto_ejecutado` | `numeric`     | Nullable    |
| `informe_cualitativo`   | `text`        | Nullable    |
| `observaciones`         | `text`        | Nullable    |
| `created_at`            | `timestamptz` | Nullable    |

## Table `efemerides`

### Columns

| Name           | Type          | Constraints |
| -------------- | ------------- | ----------- |
| `id`           | `uuid`        | Primary     |
| `nombre`       | `text`        |             |
| `anio`         | `int4`        |             |
| `fecha_inicio` | `date`        |             |
| `fecha_fin`    | `date`        |             |
| `descripcion`  | `text`        | Nullable    |
| `created_at`   | `timestamptz` |             |

## Table `campana_efemerides`

### Columns

| Name           | Type          | Constraints |
| -------------- | ------------- | ----------- |
| `campana_id`   | `uuid`        | Primary     |
| `efemeride_id` | `uuid`        | Primary     |
| `created_at`   | `timestamptz` |             |

## Table `app_roles`

### Columns

| Name         | Type          | Constraints |
| ------------ | ------------- | ----------- |
| `code`       | `text`        | Primary     |
| `name`       | `text`        |             |
| `created_at` | `timestamptz` |             |

## Table `app_permissions`

### Columns

| Name          | Type          | Constraints |
| ------------- | ------------- | ----------- |
| `code`        | `text`        | Primary     |
| `description` | `text`        |             |
| `created_at`  | `timestamptz` |             |

## Table `role_permissions`

### Columns

| Name              | Type          | Constraints |
| ----------------- | ------------- | ----------- |
| `role_code`       | `text`        | Primary     |
| `permission_code` | `text`        | Primary     |
| `created_at`      | `timestamptz` |             |

## Table `profiles`

### Columns

| Name         | Type          | Constraints |
| ------------ | ------------- | ----------- |
| `user_id`    | `uuid`        | Primary     |
| `full_name`  | `text`        | Nullable    |
| `role_code`  | `text`        |             |
| `created_at` | `timestamptz` |             |
| `updated_at` | `timestamptz` |             |

## Table `categorias_contenido`

### Columns

| Name         | Type          | Constraints |
| ------------ | ------------- | ----------- |
| `id`         | `uuid`        | Primary     |
| `codigo`     | `text`        | Unique      |
| `nombre`     | `text`        | Unique      |
| `created_at` | `timestamptz` |             |

## Table `publicacion_categorias`

### Columns

| Name             | Type          | Constraints |
| ---------------- | ------------- | ----------- |
| `publicacion_id` | `uuid`        | Primary     |
| `categoria_id`   | `uuid`        | Primary     |
| `created_at`     | `timestamptz` |             |

## Table `social_accounts`

### Columns

| Name           | Type          | Constraints |
| -------------- | ------------- | ----------- |
| `id`           | `uuid`        | Primary     |
| `platform`     | `canal_enum`  |             |
| `handle`       | `text`        |             |
| `display_name` | `text`        |             |
| `active`       | `bool`        |             |
| `created_at`   | `timestamptz` |             |

## Table `user_social_accounts`

### Columns

| Name                | Type          | Constraints |
| ------------------- | ------------- | ----------- |
| `user_id`           | `uuid`        | Primary     |
| `social_account_id` | `uuid`        | Primary     |
| `assigned_at`       | `timestamptz` |             |

## Table `publicacion_estatus_historial`

### Columns

| Name               | Type           | Constraints |
| ------------------ | -------------- | ----------- |
| `id`               | `uuid`         | Primary     |
| `publicacion_id`   | `uuid`         |             |
| `estatus_anterior` | `estatus_enum` | Nullable    |
| `estatus_nuevo`    | `estatus_enum` |             |
| `motivo`           | `text`         | Nullable    |
| `cambiado_por`     | `uuid`         | Nullable    |
| `cambiado_en`      | `timestamptz`  |             |

## Table `publicacion_comentarios`

### Columns

| Name             | Type          | Constraints |
| ---------------- | ------------- | ----------- |
| `id`             | `uuid`        | Primary     |
| `publicacion_id` | `uuid`        |             |
| `autor_id`       | `uuid`        | Nullable    |
| `texto`          | `text`        |             |
| `tipo`           | `text`        |             |
| `creado_en`      | `timestamptz` |             |

## Table `publicacion_drive_uploads`

### Columns

| Name             | Type          | Constraints |
| ---------------- | ------------- | ----------- |
| `id`             | `uuid`        | Primary     |
| `publicacion_id` | `uuid`        |             |
| `actor_id`       | `uuid`        |             |
| `file_name`      | `text`        |             |
| `mime_type`      | `text`        |             |
| `file_size`      | `int8`        |             |
| `session_uri`    | `text`        | Nullable    |
| `status`         | `text`        |             |
| `drive_file_id`  | `text`        | Nullable    |
| `expires_at`     | `timestamptz` |             |
| `created_at`     | `timestamptz` |             |
| `completed_at`   | `timestamptz` | Nullable    |

## Custom Types / Enums

### `formato_enum`

`CARRUSEL` | `POST` | `REEL` | `STORY`

### `estatus_enum`

`PENDIENTE_BRIEF` | `EN_RODAJE` | `EN_DISENO` | `EN_REVISION_CM` | `RECHAZADO_DISENO` | `PENDIENTE_APROBACION_GERENCIA` | `APROBADO` | `PROGRAMADO` | `PUBLICADO` | `SOLICITADO` | `EN_CORRECCION` | `CANCELADO` | `INCOMPLETO`

### `tipo_campana_enum`

`TEMPORADA` | `EVENTO` | `EFEMERIDE` | `LANZAMIENTO` | `OFERTA_PUNTUAL`

### `departamento_enum`

`COMPRAS` | `SELECCION` | `PROVEEDOR` | `GERENCIA` | `EVENTOS`

### `canal_enum`

`INSTAGRAM` | `TIKTOK` | `YOUTUBE_SHORTS` | `FACEBOOK` | `YOUTUBE`

### `sede_enum`

`PREBO` | `MANONGO`

## RLS Policies

### `campanas`

| Policy                             | Command | Roles         | Action     | USING                                                                                                                                                                                                                                                                   | WITH CHECK                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------- | ------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_permissions_read_campaigns`   | SELECT  | authenticated | PERMISSIVE | `( SELECT has_permission('social-media.campaigns.read'::text) AS has_permission)`                                                                                                                                                                                       | —                                                                                                                                                                                                                                                                       |
| `app_permissions_create_campaigns` | INSERT  | authenticated | PERMISSIVE | —                                                                                                                                                                                                                                                                       | `( SELECT has_permission('social-media.campaigns.create'::text) AS has_permission)`                                                                                                                                                                                     |
| `app_permissions_update_campaigns` | UPDATE  | authenticated | PERMISSIVE | `(( SELECT has_permission('social-media.campaigns.update'::text) AS has_permission) OR ( SELECT has_permission('social-media.campaigns.status.update'::text) AS has_permission) OR ( SELECT has_permission('social-media.campaigns.archive'::text) AS has_permission))` | `(( SELECT has_permission('social-media.campaigns.update'::text) AS has_permission) OR ( SELECT has_permission('social-media.campaigns.status.update'::text) AS has_permission) OR ( SELECT has_permission('social-media.campaigns.archive'::text) AS has_permission))` |

### `publicacion_categorias`

| Policy                                   | Command | Roles         | Action     | USING                                                                                                                                                                                                                                                                                                                                                                                                                                      | WITH CHECK                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ------- | ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_permissions_delete_post_categories` | DELETE  | authenticated | PERMISSIVE | `(( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) AND ( SELECT user_has_all_publication_accounts(publicacion_categorias.publicacion_id) AS user_has_all_publication_accounts))`                                                                                                                                                                                                                                | —                                                                                                                                                                                                                                                                                              |
| `app_permissions_read_post_categories`   | SELECT  | authenticated | PERMISSIVE | `((( SELECT has_permission('social-media.posts.read'::text) AS has_permission) OR ( SELECT has_permission('social-media.shooting.read'::text) AS has_permission)) AND (EXISTS ( SELECT 1    FROM (publicacion_canales pc      JOIN user_social_accounts usa ON ((usa.social_account_id = pc.social_account_id)))   WHERE ((pc.publicacion_id = publicacion_categorias.publicacion_id) AND (usa.user_id = ( SELECT auth.uid() AS uid))))))` | —                                                                                                                                                                                                                                                                                              |
| `app_permissions_create_post_categories` | INSERT  | authenticated | PERMISSIVE | —                                                                                                                                                                                                                                                                                                                                                                                                                                          | `((( SELECT has_permission('social-media.posts.create'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.edit'::text) AS has_permission)) AND ( SELECT user_has_all_publication_accounts(publicacion_categorias.publicacion_id) AS user_has_all_publication_accounts))` |

### `publicacion_canales`

| Policy                                | Command | Roles         | Action     | USING                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | WITH CHECK                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------- | ------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `publicacion_canales_read_assigned`   | SELECT  | authenticated | PERMISSIVE | `((( SELECT has_permission('social-media.posts.read'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.create'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) OR ( SELECT has_permission('social-media.shooting.read'::text) AS has_permission)) AND (EXISTS ( SELECT 1    FROM user_social_accounts usa   WHERE ((usa.social_account_id = publicacion_canales.social_account_id) AND (usa.user_id = ( SELECT auth.uid() AS uid))))))` | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `publicacion_canales_insert_assigned` | INSERT  | authenticated | PERMISSIVE | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `((( SELECT has_permission('social-media.posts.create'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.edit'::text) AS has_permission)) AND (EXISTS ( SELECT 1    FROM (user_social_accounts usa      JOIN social_accounts sa ON ((sa.id = usa.social_account_id)))   WHERE ((usa.social_account_id = publicacion_canales.social_account_id) AND (sa.platform = publicacion_canales.canal) AND sa.active AND (usa.user_id = ( SELECT auth.uid() AS uid))))))` |
| `publicacion_canales_delete_assigned` | DELETE  | authenticated | PERMISSIVE | `(( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) AND (EXISTS ( SELECT 1    FROM user_social_accounts usa   WHERE ((usa.social_account_id = publicacion_canales.social_account_id) AND (usa.user_id = ( SELECT auth.uid() AS uid))))))`                                                                                                                                                                                                                                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `publicacion_canales_update_assigned` | UPDATE  | authenticated | PERMISSIVE | `(( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) AND (EXISTS ( SELECT 1    FROM user_social_accounts usa   WHERE ((usa.social_account_id = publicacion_canales.social_account_id) AND (usa.user_id = ( SELECT auth.uid() AS uid))))))`                                                                                                                                                                                                                                                     | `(( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) AND (EXISTS ( SELECT 1    FROM (user_social_accounts usa      JOIN social_accounts sa ON ((sa.id = usa.social_account_id)))   WHERE ((usa.social_account_id = publicacion_canales.social_account_id) AND (usa.user_id = ( SELECT auth.uid() AS uid)) AND (sa.platform = publicacion_canales.canal)))))`                                                                                                  |

### `profiles`

| Policy                                | Command | Roles         | Action     | USING                                                | WITH CHECK                                           |
| ------------------------------------- | ------- | ------------- | ---------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `Users can read their own profile`    | SELECT  | authenticated | PERMISSIVE | `(user_id = ( SELECT auth.uid() AS uid))`            | —                                                    |
| `Access admins can read all profiles` | SELECT  | authenticated | PERMISSIVE | `( SELECT can_manage_access() AS can_manage_access)` | —                                                    |
| `Access admins can update profiles`   | UPDATE  | authenticated | PERMISSIVE | `( SELECT can_manage_access() AS can_manage_access)` | `( SELECT can_manage_access() AS can_manage_access)` |

### `efemerides`

| Policy                              | Command | Roles         | Action     | USING                                                                                | WITH CHECK                                                                           |
| ----------------------------------- | ------- | ------------- | ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `app_permissions_read_efemerides`   | SELECT  | authenticated | PERMISSIVE | `( SELECT has_permission('social-media.efemerides.read'::text) AS has_permission)`   | —                                                                                    |
| `app_permissions_create_efemerides` | INSERT  | authenticated | PERMISSIVE | —                                                                                    | `( SELECT has_permission('social-media.efemerides.create'::text) AS has_permission)` |
| `app_permissions_update_efemerides` | UPDATE  | authenticated | PERMISSIVE | `( SELECT has_permission('social-media.efemerides.update'::text) AS has_permission)` | `( SELECT has_permission('social-media.efemerides.update'::text) AS has_permission)` |
| `app_permissions_delete_efemerides` | DELETE  | authenticated | PERMISSIVE | `( SELECT has_permission('social-media.efemerides.delete'::text) AS has_permission)` | —                                                                                    |

### `campana_efemerides`

| Policy                                     | Command | Roles         | Action     | USING                                                                                                                                                                   | WITH CHECK |
| ------------------------------------------ | ------- | ------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `app_permissions_read_campaign_efemerides` | SELECT  | authenticated | PERMISSIVE | `(( SELECT has_permission('social-media.campaigns.read'::text) AS has_permission) OR ( SELECT has_permission('social-media.efemerides.read'::text) AS has_permission))` | —          |

### `campana_evaluaciones`

| Policy                                        | Command | Roles         | Action     | USING                                                                             | WITH CHECK                                                                                     |
| --------------------------------------------- | ------- | ------------- | ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app_permissions_read_campaign_evaluations`   | SELECT  | authenticated | PERMISSIVE | `( SELECT has_permission('social-media.campaigns.read'::text) AS has_permission)` | —                                                                                              |
| `app_permissions_create_campaign_evaluations` | INSERT  | authenticated | PERMISSIVE | —                                                                                 | `( SELECT has_permission('social-media.campaigns.evaluation.create'::text) AS has_permission)` |

### `social_accounts`

| Policy                          | Command | Roles         | Action     | USING                                                                                                                                                          | WITH CHECK |
| ------------------------------- | ------- | ------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `social_accounts_read_assigned` | SELECT  | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM user_social_accounts usa   WHERE ((usa.social_account_id = social_accounts.id) AND (usa.user_id = ( SELECT auth.uid() AS uid)))))` | —          |

### `user_social_accounts`

| Policy                          | Command | Roles         | Action     | USING                                     | WITH CHECK |
| ------------------------------- | ------- | ------------- | ---------- | ----------------------------------------- | ---------- |
| `user_social_accounts_read_own` | SELECT  | authenticated | PERMISSIVE | `(user_id = ( SELECT auth.uid() AS uid))` | —          |

### `publicaciones`

| Policy                         | Command | Roles         | Action     | USING                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | WITH CHECK                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------- | ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_permissions_create_posts` | INSERT  | authenticated | PERMISSIVE | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `( SELECT has_permission('social-media.posts.create'::text) AS has_permission)`                                                                                                                                                                                                                                                                                                                                                                                  |
| `app_permissions_read_posts`   | SELECT  | authenticated | PERMISSIVE | `((( SELECT has_permission('social-media.posts.read'::text) AS has_permission) OR ( SELECT has_permission('social-media.shooting.read'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.create'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.edit'::text) AS has_permission)) AND (EXISTS ( SELECT 1    FROM (publicacion_canales pc      JOIN user_social_accounts usa ON ((usa.social_account_id = pc.social_account_id)))   WHERE ((pc.publicacion_id = publicaciones.id) AND (usa.user_id = ( SELECT auth.uid() AS uid))))))` | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `app_permissions_update_posts` | UPDATE  | authenticated | PERMISSIVE | `((( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.reschedule'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.status.update'::text) AS has_permission) OR ( SELECT has_permission('social-media.shooting.status.update'::text) AS has_permission)) AND ( SELECT user_has_all_publication_accounts(publicaciones.id) AS user_has_all_publication_accounts))`                                                                                                                      | `((( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.reschedule'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.status.update'::text) AS has_permission) OR ( SELECT has_permission('social-media.shooting.status.update'::text) AS has_permission)) AND ( SELECT user_has_all_publication_accounts(publicaciones.id) AS user_has_all_publication_accounts))` |

### `categorias_contenido`

| Policy                                    | Command | Roles         | Action     | USING                                                                                                                                                                                                                                                                                                                             | WITH CHECK |
| ----------------------------------------- | ------- | ------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `app_permissions_read_content_categories` | SELECT  | authenticated | PERMISSIVE | `(( SELECT has_permission('social-media.posts.read'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.create'::text) AS has_permission) OR ( SELECT has_permission('social-media.posts.edit'::text) AS has_permission) OR ( SELECT has_permission('social-media.shooting.read'::text) AS has_permission))` | —          |

### `publicacion_estatus_historial`

| Policy                            | Command | Roles         | Action     | USING                                                                                                                                                                                                                                                                                                                                                         | WITH CHECK |
| --------------------------------- | ------- | ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `publication_status_history_read` | SELECT  | authenticated | PERMISSIVE | `(( SELECT has_permission('social-media.posts.read'::text) AS has_permission) AND (EXISTS ( SELECT 1    FROM (publicacion_canales pc      JOIN user_social_accounts usa ON ((usa.social_account_id = pc.social_account_id)))   WHERE ((pc.publicacion_id = publicacion_estatus_historial.publicacion_id) AND (usa.user_id = ( SELECT auth.uid() AS uid))))))` | —          |

### `publicacion_comentarios`

| Policy                      | Command | Roles         | Action     | USING                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | WITH CHECK |
| --------------------------- | ------- | ------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `publication_comments_read` | SELECT  | authenticated | PERMISSIVE | `((( SELECT has_permission('social-media.posts.read'::text) AS has_permission) AND (EXISTS ( SELECT 1    FROM (publicacion_canales pc      JOIN user_social_accounts usa ON ((usa.social_account_id = pc.social_account_id)))   WHERE ((pc.publicacion_id = publicacion_comentarios.publicacion_id) AND (usa.user_id = ( SELECT auth.uid() AS uid)))))) OR (( SELECT has_permission('design.posts.read'::text) AS has_permission) AND (EXISTS ( SELECT 1    FROM publicaciones p   WHERE ((p.id = publicacion_comentarios.publicacion_id) AND (p.deleted_at IS NULL) AND (p.estatus = ANY (ARRAY['SOLICITADO'::estatus_enum, 'EN_DISENO'::estatus_enum, 'EN_CORRECCION'::estatus_enum])))))))` | —          |
