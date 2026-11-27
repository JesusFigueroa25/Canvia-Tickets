-- 01. incident_sla
CREATE TABLE dbo.incident_sla (
    Ticket_ID VARCHAR(20) NOT NULL,
    Proyecto NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fecha_Creacion DATETIME2(0) NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Estado NVARCHAR(50) NULL,
    Codigo_Motivo NVARCHAR(50) NULL,
    Prioridad VARCHAR(5) NULL,
    Usuario_Resolutor NVARCHAR(100) NULL,
    Grupo_Resolutor NVARCHAR(100) NULL,
    Categorizacion_Clase NVARCHAR(100) NULL,
    Categorizacion_Categoria NVARCHAR(100) NULL,
    Categorizacion_Tipo NVARCHAR(150) NULL,
    SLA_Respuesta_Condicion NVARCHAR(30) NULL,
    OLA_Respuesta_Condicion NVARCHAR(30) NULL,
    SLA_Solucion_Condicion NVARCHAR(30) NULL,
    OLA_Solucion_Condicion NVARCHAR(30) NULL,
    Condicion_dia NVARCHAR(15) NOT NULL,

    CONSTRAINT PK_incident_sla
        PRIMARY KEY (Ticket_ID),

    CONSTRAINT CK_incident_sla_Condicion_dia
        CHECK (
            Condicion_dia IN (
                N'Lun-Vie',
                N'Fin Sem.',
                N'Fuera Horario'
            )
        )
);


-- 02. requirement_sla
CREATE TABLE dbo.requirement_sla (
    Ticket_ID VARCHAR(20) NOT NULL,
    Proyecto NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fecha_Creacion DATETIME2(0) NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Estado NVARCHAR(50) NULL,
    Codigo_Motivo NVARCHAR(50) NULL,
    Prioridad VARCHAR(5) NULL,
    Usuario_Resolutor NVARCHAR(100) NULL,
    Grupo_Resolutor NVARCHAR(100) NULL,
    Categorizacion_Clase NVARCHAR(100) NULL,
    Categorizacion_Categoria NVARCHAR(100) NULL,
    Categorizacion_Tipo NVARCHAR(150) NULL,
    SLA_Respuesta_Condicion NVARCHAR(30) NULL,
    OLA_Respuesta_Condicion NVARCHAR(30) NULL,
    SLA_Solucion_Condicion NVARCHAR(30) NULL,
    OLA_Solucion_Condicion NVARCHAR(30) NULL,
    Condicion_dia NVARCHAR(15) NOT NULL,

    CONSTRAINT PK_requirement_sla
        PRIMARY KEY (Ticket_ID),

    CONSTRAINT CK_requirement_sla_Condicion_dia
        CHECK (
            Condicion_dia IN (
                N'Lun-Vie',
                N'Fin Sem.',
                N'Fuera Horario'
            )
        )
);


-- 03. incident_consolidated
CREATE TABLE dbo.incident_consolidated (
    Ticket_ID VARCHAR(20) NOT NULL,
    Fecha_Apertura DATETIME2(0) NOT NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Fecha_Cierre DATETIME2(0) NULL,
    Fecha_Ultima_Modificacion DATETIME2(0) NULL,
    Proyecto NVARCHAR(200) NULL,
    ALP VARCHAR(30) NULL,
    BU NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Categorizacion_Nivel_1 NVARCHAR(150) NULL,
    Categorizacion_Nivel_2 NVARCHAR(150) NULL,
    Categorizacion_Nivel_3 NVARCHAR(200) NULL,
    Prioridad NVARCHAR(30) NULL,
    Urgencia NVARCHAR(30) NULL,
    Impacto NVARCHAR(30) NULL,
    Estado NVARCHAR(50) NULL,
    Motivo_Estado NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fuente_Reportada NVARCHAR(100) NULL,
    Solucion NVARCHAR(MAX) NULL,
    Motivo_Resolucion NVARCHAR(100) NULL,
    Causa NVARCHAR(MAX) NULL,

    CONSTRAINT PK_incident_consolidated
        PRIMARY KEY (Ticket_ID)
);


-- 04. requirement_consolidated
CREATE TABLE dbo.requirement_consolidated (
    Ticket_ID VARCHAR(20) NOT NULL,
    Fecha_Apertura DATETIME2(0) NOT NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Fecha_Cierre DATETIME2(0) NULL,
    Fecha_Ultima_Modificacion DATETIME2(0) NULL,
    Proyecto NVARCHAR(200) NULL,
    ALP VARCHAR(30) NULL,
    BU NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Categorizacion_Nivel_1 NVARCHAR(150) NULL,
    Categorizacion_Nivel_2 NVARCHAR(150) NULL,
    Categorizacion_Nivel_3 NVARCHAR(200) NULL,
    Prioridad NVARCHAR(30) NULL,
    Urgencia NVARCHAR(30) NULL,
    Impacto NVARCHAR(30) NULL,
    Estado NVARCHAR(50) NULL,
    Motivo_Estado NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fuente_Reportada NVARCHAR(100) NULL,
    Solucion NVARCHAR(MAX) NULL,
    Motivo_Resolucion NVARCHAR(100) NULL,

    CONSTRAINT PK_requirement_consolidated
        PRIMARY KEY (Ticket_ID)
);


-- 05. task_consolidated
CREATE TABLE dbo.task_consolidated (
    Ticket_ID VARCHAR(20) NOT NULL,
    Ticket_Padre VARCHAR(20) NULL,
    Fecha_Apertura DATETIME2(0) NOT NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Fecha_Cierre DATETIME2(0) NULL,
    Fecha_Ultima_Modificacion DATETIME2(0) NULL,
    Proyecto NVARCHAR(200) NULL,
    ALP VARCHAR(30) NULL,
    BU NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Categorizacion_Nivel_1 NVARCHAR(150) NULL,
    Categorizacion_Nivel_2 NVARCHAR(150) NULL,
    Categorizacion_Nivel_3 NVARCHAR(200) NULL,
    Prioridad NVARCHAR(30) NULL,
    Urgencia NVARCHAR(30) NULL,
    Impacto NVARCHAR(30) NULL,
    Estado NVARCHAR(50) NULL,
    Motivo_Estado NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fuente_Reportada NVARCHAR(100) NULL,

    CONSTRAINT PK_task_consolidated
        PRIMARY KEY (Ticket_ID)
);


-- 06. stg_task_consolidated
CREATE TABLE dbo.stg_task_consolidated (
    Ticket_ID VARCHAR(20) NULL,
    Ticket_Padre VARCHAR(20) NULL,
    Fecha_Apertura DATETIME2(0) NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Fecha_Cierre DATETIME2(0) NULL,
    Fecha_Ultima_Modificacion DATETIME2(0) NULL,
    Proyecto NVARCHAR(200) NULL,
    ALP VARCHAR(30) NULL,
    BU NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Categorizacion_Nivel_1 NVARCHAR(150) NULL,
    Categorizacion_Nivel_2 NVARCHAR(150) NULL,
    Categorizacion_Nivel_3 NVARCHAR(200) NULL,
    Prioridad NVARCHAR(30) NULL,
    Urgencia NVARCHAR(30) NULL,
    Impacto NVARCHAR(30) NULL,
    Estado NVARCHAR(50) NULL,
    Motivo_Estado NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fuente_Reportada NVARCHAR(100) NULL
);


-- 07. import_run
CREATE TABLE dbo.import_run (
    Eir_ID INT IDENTITY(1,1) NOT NULL,
    Eir_Tipo VARCHAR(50) NOT NULL,
    Eir_Nombre_Archivo NVARCHAR(255) NULL,
    Eir_Fecha_Inicio DATETIME2(0) NOT NULL,
    Eir_Fecha_Fin DATETIME2(0) NULL,
    Eir_Estado VARCHAR(20) NOT NULL,

    Eir_Filas_Excel INT NOT NULL DEFAULT (0),
    Eir_Filas_Aceptadas INT NOT NULL DEFAULT (0),
    Eir_Filas_Rechazadas INT NOT NULL DEFAULT (0),
    Eir_Tickets_Nuevos INT NOT NULL DEFAULT (0),
    Eir_Tickets_Modificados INT NOT NULL DEFAULT (0),
    Eir_Tickets_Sin_Cambios INT NOT NULL DEFAULT (0),

    Eir_SQLServer_Status VARCHAR(20) NULL,
    Eir_SQLite_Status VARCHAR(20) NULL,
    Eir_Error_Mensaje NVARCHAR(MAX) NULL,

    CONSTRAINT PK_import_run
        PRIMARY KEY (Eir_ID)
);



-- 08. stg_incident_consolidated
CREATE TABLE dbo.stg_incident_consolidated (
    Ticket_ID VARCHAR(20) NULL,
    Fecha_Apertura DATETIME2(0) NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Fecha_Cierre DATETIME2(0) NULL,
    Fecha_Ultima_Modificacion DATETIME2(0) NULL,
    Proyecto NVARCHAR(200) NULL,
    ALP VARCHAR(30) NULL,
    BU NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Categorizacion_Nivel_1 NVARCHAR(150) NULL,
    Categorizacion_Nivel_2 NVARCHAR(150) NULL,
    Categorizacion_Nivel_3 NVARCHAR(200) NULL,
    Prioridad NVARCHAR(30) NULL,
    Urgencia NVARCHAR(30) NULL,
    Impacto NVARCHAR(30) NULL,
    Estado NVARCHAR(50) NULL,
    Motivo_Estado NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fuente_Reportada NVARCHAR(100) NULL,
    Solucion NVARCHAR(MAX) NULL,
    Motivo_Resolucion NVARCHAR(100) NULL,
    Causa NVARCHAR(MAX) NULL
);


-- 09. stg_requirement_consolidated
CREATE TABLE dbo.stg_requirement_consolidated (
    Ticket_ID VARCHAR(20) NULL,
    Fecha_Apertura DATETIME2(0) NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Fecha_Cierre DATETIME2(0) NULL,
    Fecha_Ultima_Modificacion DATETIME2(0) NULL,
    Proyecto NVARCHAR(200) NULL,
    ALP VARCHAR(30) NULL,
    BU NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Categorizacion_Nivel_1 NVARCHAR(150) NULL,
    Categorizacion_Nivel_2 NVARCHAR(150) NULL,
    Categorizacion_Nivel_3 NVARCHAR(200) NULL,
    Prioridad NVARCHAR(30) NULL,
    Urgencia NVARCHAR(30) NULL,
    Impacto NVARCHAR(30) NULL,
    Estado NVARCHAR(50) NULL,
    Motivo_Estado NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fuente_Reportada NVARCHAR(100) NULL,
    Solucion NVARCHAR(MAX) NULL,
    Motivo_Resolucion NVARCHAR(100) NULL
);


-- 10. stg_requirement_sla
CREATE TABLE dbo.stg_requirement_sla (
    Ticket_ID VARCHAR(20) NULL,
    Proyecto NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fecha_Creacion DATETIME2(0) NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Estado NVARCHAR(50) NULL,
    Codigo_Motivo NVARCHAR(50) NULL,
    Prioridad VARCHAR(5) NULL,
    Usuario_Resolutor NVARCHAR(100) NULL,
    Grupo_Resolutor NVARCHAR(100) NULL,
    Categorizacion_Clase NVARCHAR(100) NULL,
    Categorizacion_Categoria NVARCHAR(100) NULL,
    Categorizacion_Tipo NVARCHAR(150) NULL,
    SLA_Respuesta_Condicion NVARCHAR(30) NULL,
    OLA_Respuesta_Condicion NVARCHAR(30) NULL,
    SLA_Solucion_Condicion NVARCHAR(30) NULL,
    OLA_Solucion_Condicion NVARCHAR(30) NULL
);


-- 11. stg_incident_sla
CREATE TABLE dbo.stg_incident_sla (
    Ticket_ID VARCHAR(20) NULL,
    Proyecto NVARCHAR(100) NULL,
    Descripcion NVARCHAR(1000) NULL,
    Detalle NVARCHAR(MAX) NULL,
    Fecha_Creacion DATETIME2(0) NULL,
    Fecha_Resolucion DATETIME2(0) NULL,
    Estado NVARCHAR(50) NULL,
    Codigo_Motivo NVARCHAR(50) NULL,
    Prioridad VARCHAR(5) NULL,
    Usuario_Resolutor NVARCHAR(100) NULL,
    Grupo_Resolutor NVARCHAR(100) NULL,
    Categorizacion_Clase NVARCHAR(100) NULL,
    Categorizacion_Categoria NVARCHAR(100) NULL,
    Categorizacion_Tipo NVARCHAR(150) NULL,
    SLA_Respuesta_Condicion NVARCHAR(30) NULL,
    OLA_Respuesta_Condicion NVARCHAR(30) NULL,
    SLA_Solucion_Condicion NVARCHAR(30) NULL,
    OLA_Solucion_Condicion NVARCHAR(30) NULL
);


-- 12. ai_conversations
CREATE TABLE dbo.ai_conversations (
    id INT IDENTITY(1,1) NOT NULL,

    title NVARCHAR(200) NOT NULL
        DEFAULT (N'Nueva conversación'),

    created_at DATETIME2(0) NOT NULL
        DEFAULT (SYSUTCDATETIME()),

    context_state NVARCHAR(MAX) NOT NULL
        DEFAULT (N'{}'),

    CONSTRAINT PK_ai_conversations
        PRIMARY KEY (id),

    CONSTRAINT CK_ai_conversations_context_state
        CHECK (ISJSON(context_state) = 1)
);


-- 13. ai_messages
CREATE TABLE dbo.ai_messages (
    id INT IDENTITY(1,1) NOT NULL,
    conversation_id INT NOT NULL,
    role NVARCHAR(20) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,

    created_at DATETIME2(0) NOT NULL
        DEFAULT (SYSUTCDATETIME()),

    response_type NVARCHAR(20) NULL,
    source NVARCHAR(100) NULL,
    filters_json NVARCHAR(MAX) NULL,
    metrics_json NVARCHAR(MAX) NULL,
    evidence_json NVARCHAR(MAX) NULL,

    CONSTRAINT PK_ai_messages
        PRIMARY KEY (id),

    CONSTRAINT FK_ai_messages_conversations
        FOREIGN KEY (conversation_id)
        REFERENCES dbo.ai_conversations(id)
        ON DELETE CASCADE,

    CONSTRAINT CK_ai_messages_role
        CHECK (role IN (N'user', N'assistant')),

    CONSTRAINT CK_ai_messages_response_type
        CHECK (
            response_type IS NULL
            OR response_type IN (
                N'text', N'chart', N'mixed'
            )
        ),

    CONSTRAINT CK_ai_messages_filters_json
        CHECK (
            filters_json IS NULL
            OR ISJSON(filters_json) = 1
        ),

    CONSTRAINT CK_ai_messages_metrics_json
        CHECK (
            metrics_json IS NULL
            OR ISJSON(metrics_json) = 1
        ),

    CONSTRAINT CK_ai_messages_evidence_json
        CHECK (
            evidence_json IS NULL
            OR ISJSON(evidence_json) = 1
        )
);

-- Índice existente:
CREATE NONCLUSTERED INDEX IX_ai_messages_conversation_id_id
ON dbo.ai_messages (conversation_id, id);




-- 14. requirement_category_catalog
CREATE TABLE dbo.requirement_category_catalog (
    catalog_id BIGINT IDENTITY(1,1) NOT NULL,
    level_1 NVARCHAR(150) NOT NULL,
    level_2 NVARCHAR(150) NOT NULL,
    level_3 NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NULL,
    examples NVARCHAR(MAX) NULL,

    catalog_source VARCHAR(30) NOT NULL
        DEFAULT ('SQL_SERVER'),

    validation_status VARCHAR(20) NOT NULL
        DEFAULT ('OBSERVED'),

    first_observed_at DATETIME2(0) NULL,
    last_observed_at DATETIME2(0) NULL,

    created_at DATETIME2(0) NOT NULL
        DEFAULT (SYSUTCDATETIME()),

    updated_at DATETIME2(0) NOT NULL
        DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_requirement_category_catalog
        PRIMARY KEY (catalog_id),

    CONSTRAINT CK_rc_catalog_source
        CHECK (
            catalog_source IN (
                'SQL_SERVER', 'SERVICE_AIDE', 'MANUAL'
            )
        ),

    CONSTRAINT CK_rc_catalog_validation
        CHECK (
            validation_status IN (
                'OBSERVED', 'VALIDATED'
            )
        ),

    CONSTRAINT CK_rc_catalog_dates
        CHECK (
            first_observed_at IS NULL
            OR last_observed_at IS NULL
            OR last_observed_at >= first_observed_at
        )
);

CREATE UNIQUE NONCLUSTERED INDEX UX_rc_catalog_route
ON dbo.requirement_category_catalog (
    level_1, level_2, level_3
);


-- 15. requirement_categorization_audit_runs
CREATE TABLE dbo.requirement_categorization_audit_runs (
    run_id BIGINT IDENTITY(1,1) NOT NULL,
    grupo_resolutor NVARCHAR(150) NOT NULL,
    period_from DATE NULL,
    period_to DATE NULL,

    status VARCHAR(20) NOT NULL
        DEFAULT ('PENDING'),

    model_name NVARCHAR(200) NULL,
    model_version NVARCHAR(100) NULL,
    engine_version NVARCHAR(50) NULL,
    catalog_snapshot_hash CHAR(64) NULL,

    total_tickets INT NOT NULL DEFAULT (0),
    processed_tickets INT NOT NULL DEFAULT (0),
    correct_count INT NOT NULL DEFAULT (0),
    incorrect_count INT NOT NULL DEFAULT (0),
    review_count INT NOT NULL DEFAULT (0),
    error_count INT NOT NULL DEFAULT (0),

    created_at DATETIME2(0) NOT NULL
        DEFAULT (SYSUTCDATETIME()),

    started_at DATETIME2(0) NULL,
    finished_at DATETIME2(0) NULL,
    error_message NVARCHAR(2000) NULL,

    group_id BIGINT NULL,

    CONSTRAINT PK_requirement_categorization_audit_runs
        PRIMARY KEY (run_id),

    CONSTRAINT FK_rc_runs_group
        FOREIGN KEY (group_id)
        REFERENCES dbo.requirement_categorization_audit_groups(group_id),

    CONSTRAINT CK_rc_runs_status
        CHECK (
            status IN (
                'PENDING', 'RUNNING', 'COMPLETED',
                'PARTIAL', 'FAILED'
            )
        ),

    CONSTRAINT CK_rc_runs_dates
        CHECK (
            period_from IS NULL
            OR period_to IS NULL
            OR period_to >= period_from
        ),

    CONSTRAINT CK_rc_runs_counts
        CHECK (
            total_tickets >= 0
            AND processed_tickets >= 0
            AND correct_count >= 0
            AND incorrect_count >= 0
            AND review_count >= 0
            AND error_count >= 0
        )
);


-- 16. requirement_categorization_audit_results
CREATE TABLE dbo.requirement_categorization_audit_results (
    result_id BIGINT IDENTITY(1,1) NOT NULL,
    run_id BIGINT NOT NULL,
    ticket_id VARCHAR(20) NOT NULL,
    grupo_resolutor NVARCHAR(150) NOT NULL,
    resolver_name NVARCHAR(150) NULL,
    project_name NVARCHAR(200) NULL,
    source_opened_at DATETIME2(0) NOT NULL,
    source_status NVARCHAR(50) NULL,
    source_last_modified_at DATETIME2(0) NULL,

    original_level_1 NVARCHAR(150) NULL,
    original_level_2 NVARCHAR(150) NULL,
    original_level_3 NVARCHAR(200) NULL,

    original_catalog_id BIGINT NULL,
    suggested_catalog_id BIGINT NULL,

    result_status VARCHAR(10) NOT NULL,
    reason_code VARCHAR(60) NOT NULL,
    reason_text NVARCHAR(2000) NOT NULL,
    evidence_json NVARCHAR(MAX) NULL,
    semantic_score FLOAT NULL,
    source_hash CHAR(64) NOT NULL,

    evaluated_at DATETIME2(0) NOT NULL
        DEFAULT (SYSUTCDATETIME()),

    source_status_reason NVARCHAR(100) NULL,
    source_resolved_at DATETIME2(0) NULL,
    ticket_lifecycle_status VARCHAR(20) NULL,
    has_solution BIT NULL,
    solution_check_status VARCHAR(24) NULL,
    solution_check_reason NVARCHAR(500) NULL,

    CONSTRAINT PK_requirement_categorization_audit_results
        PRIMARY KEY (result_id),

    CONSTRAINT FK_rc_results_run
        FOREIGN KEY (run_id)
        REFERENCES dbo.requirement_categorization_audit_runs(run_id),

    CONSTRAINT FK_rc_results_original_catalog
        FOREIGN KEY (original_catalog_id)
        REFERENCES dbo.requirement_category_catalog(catalog_id),

    CONSTRAINT FK_rc_results_suggested_catalog
        FOREIGN KEY (suggested_catalog_id)
        REFERENCES dbo.requirement_category_catalog(catalog_id),

    CONSTRAINT CK_rc_results_status
        CHECK (
            result_status IN ('CORRECT', 'INCORRECT')
        ),

    CONSTRAINT CK_rc_results_evidence_json
        CHECK (
            evidence_json IS NULL
            OR ISJSON(evidence_json) = 1
        ),

    CONSTRAINT CK_rc_results_lifecycle
        CHECK (
            ticket_lifecycle_status IN (
                'RESOLVED', 'CANCELLED',
                'OPEN', 'UNCERTAIN'
            )
        ),

    CONSTRAINT CK_rc_results_solution_check
        CHECK (
            solution_check_status IN (
                'PRESENT',
                'MISSING_REQUIRED',
                'OPTIONAL_MISSING',
                'REVIEW_STATUS'
            )
        )
);

CREATE UNIQUE NONCLUSTERED INDEX UX_rc_results_run_ticket
ON dbo.requirement_categorization_audit_results (
    run_id, ticket_id
);


-- 17. requirement_categorization_audit_groups
CREATE TABLE dbo.requirement_categorization_audit_groups (
    group_id BIGINT IDENTITY(1,1) NOT NULL,
    group_name NVARCHAR(200) NOT NULL,
    grupo_resolutor NVARCHAR(150) NOT NULL,
    audit_year SMALLINT NOT NULL,
    description NVARCHAR(500) NULL,

    created_at DATETIME2(0) NOT NULL
        DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_rc_audit_groups
        PRIMARY KEY (group_id),

    CONSTRAINT UQ_rc_groups_resolver_year
        UNIQUE (grupo_resolutor, audit_year),

    CONSTRAINT CK_rc_groups_year
        CHECK (audit_year BETWEEN 2000 AND 2100)
);


-- 18. tickets_manual_updates
CREATE TABLE dbo.tickets_manual_updates (
    Actualizacion_ID BIGINT IDENTITY(1,1) NOT NULL,
    Ticket_ID VARCHAR(20) NOT NULL,
    Fecha_Creacion DATETIME2(0) NULL,
    Ticket_type NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Motivo_Resolucion NVARCHAR(150) NULL,
    Estado NVARCHAR(50) NULL,
    Proyecto NVARCHAR(200) NULL,

    CONSTRAINT PK_requirement_manual_updates
        PRIMARY KEY (Actualizacion_ID)
);

CREATE UNIQUE NONCLUSTERED INDEX UX_tickets_manual_updates_Ticket_ID
ON dbo.tickets_manual_updates (Ticket_ID);


-- 19. stg_tickets_manual_updates
CREATE TABLE dbo.stg_tickets_manual_updates (
    Lote_ID UNIQUEIDENTIFIER NOT NULL,
    Fila_Excel INT NOT NULL,
    Ticket_ID VARCHAR(20) NULL,
    Fecha_Creacion DATETIME2(0) NULL,
    Ticket_type NVARCHAR(50) NULL,
    Grupo_Resolutor NVARCHAR(150) NULL,
    Nombre_Resolutor NVARCHAR(150) NULL,
    Motivo_Resolucion NVARCHAR(150) NULL,
    Estado NVARCHAR(50) NULL,
    Proyecto NVARCHAR(200) NULL,

    CONSTRAINT PK_stg_tickets_manual_updates
        PRIMARY KEY (Lote_ID, Fila_Excel)
);
