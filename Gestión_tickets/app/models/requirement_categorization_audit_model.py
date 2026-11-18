from sqlalchemy import (CHAR,BigInteger,CheckConstraint,Column,Float,ForeignKey,Identity,Index,Integer,PrimaryKeyConstraint,SmallInteger,String,UniqueConstraint,text,)
from sqlalchemy.dialects.mssql import (BIT,DATE,DATETIME2,NVARCHAR,)
from sqlalchemy.orm import relationship

from app.database.database import Base


class RequirementCategoryCatalog(Base):
    __tablename__ = "requirement_category_catalog"

    catalog_id = Column(BigInteger,Identity(start=1, increment=1),nullable=False,)
    level_1 = Column(NVARCHAR(150), nullable=False)
    level_2 = Column(NVARCHAR(150), nullable=False)
    level_3 = Column(NVARCHAR(200), nullable=False)
    description = Column(NVARCHAR(None), nullable=True)
    examples = Column(NVARCHAR(None), nullable=True)
    catalog_source = Column(String(30),nullable=False,server_default=text("'SQL_SERVER'"),)
    validation_status = Column(String(20),nullable=False,server_default=text("'OBSERVED'"),)
    first_observed_at = Column(DATETIME2(precision=0),nullable=True,)
    last_observed_at = Column(DATETIME2(precision=0),nullable=True,)
    created_at = Column(DATETIME2(precision=0),nullable=False,server_default=text("SYSUTCDATETIME()"),)
    updated_at = Column(DATETIME2(precision=0),nullable=False,server_default=text("SYSUTCDATETIME()"),)
    
    __table_args__ = (
        PrimaryKeyConstraint(
            "catalog_id",
            name="PK_requirement_category_catalog",
        ),

        CheckConstraint(
            "catalog_source IN "
            "('SQL_SERVER', 'SERVICE_AIDE', 'MANUAL')",
            name="CK_rc_catalog_source",
        ),

        CheckConstraint(
            "validation_status IN "
            "('OBSERVED', 'VALIDATED')",
            name="CK_rc_catalog_validation",
        ),

        CheckConstraint(
            "first_observed_at IS NULL "
            "OR last_observed_at IS NULL "
            "OR last_observed_at >= first_observed_at",
            name="CK_rc_catalog_dates",
        ),

        Index("UX_rc_catalog_route","level_1","level_2","level_3",unique=True,),

        {"schema": "dbo"},
    )

class RequirementCategorizationAuditRun(Base):
    __tablename__ = "requirement_categorization_audit_runs"

    run_id = Column(BigInteger,Identity(start=1, increment=1),nullable=False,)
    grupo_resolutor = Column(NVARCHAR(150),nullable=False,)
    period_from = Column(DATE, nullable=True)
    period_to = Column(DATE, nullable=True)
    status = Column(String(20),nullable=False,server_default=text("'PENDING'"),)
    model_name = Column(NVARCHAR(200), nullable=True)
    model_version = Column(NVARCHAR(100), nullable=True)
    engine_version = Column(NVARCHAR(50), nullable=True)
    catalog_snapshot_hash = Column(CHAR(64),nullable=True,)
    total_tickets = Column(Integer,nullable=False,server_default=text("0"),)
    processed_tickets = Column(Integer,nullable=False,server_default=text("0"),)
    correct_count = Column(Integer,nullable=False,server_default=text("0"),)
    incorrect_count = Column(Integer,nullable=False,server_default=text("0"),)
    review_count = Column(Integer,nullable=False,server_default=text("0"),)
    error_count = Column(Integer,nullable=False,server_default=text("0"),)
    created_at = Column(DATETIME2(precision=0),nullable=False,server_default=text("SYSUTCDATETIME()"),)
    started_at = Column(DATETIME2(precision=0),nullable=True,)
    finished_at = Column(DATETIME2(precision=0),nullable=True,)
    error_message = Column(NVARCHAR(2000),nullable=True,)
    group_id = Column(BigInteger,ForeignKey("dbo.requirement_categorization_audit_groups.group_id",name="FK_rc_runs_group",),nullable=True,)
    results = relationship("RequirementCategorizationAuditResult",back_populates="run",)
    audit_group = relationship("RequirementCategorizationAuditGroup",back_populates="runs",)
    __table_args__ = (
        PrimaryKeyConstraint(
            "run_id",
            name="PK_requirement_categorization_audit_runs",
        ),

        CheckConstraint(
            "status IN "
            "('PENDING', 'RUNNING', 'COMPLETED', "
            "'PARTIAL', 'FAILED')",
            name="CK_rc_runs_status",
        ),

        CheckConstraint(
            "period_from IS NULL "
            "OR period_to IS NULL "
            "OR period_to >= period_from",
            name="CK_rc_runs_dates",
        ),

        CheckConstraint(
            "total_tickets >= 0 "
            "AND processed_tickets >= 0 "
            "AND correct_count >= 0 "
            "AND incorrect_count >= 0 "
            "AND review_count >= 0 "
            "AND error_count >= 0",
            name="CK_rc_runs_counts",
        ),

        Index(
            "IX_rc_runs_group_created",
            "grupo_resolutor",
            created_at.desc(),
            mssql_include=[
                "status",
                "total_tickets",
                "processed_tickets",
            ],
        ),
        
        
        Index(
            "IX_rc_runs_group_period",
            "group_id",
            "period_from",
            "period_to",
            mssql_include=[
                "status",
                "total_tickets",
                "processed_tickets",
            ],
        ),

        {"schema": "dbo"},
    )


class RequirementCategorizationAuditResult(Base):
    __tablename__ = "requirement_categorization_audit_results"
    result_id = Column(BigInteger,Identity(start=1, increment=1),nullable=False,)
    run_id = Column(BigInteger,ForeignKey("dbo.requirement_categorization_audit_runs.run_id",name="FK_rc_results_run",),nullable=False,)
    ticket_id = Column(String(20),nullable=False,)
    grupo_resolutor = Column(NVARCHAR(150),nullable=False,)
    resolver_name = Column(NVARCHAR(150),nullable=True,)
    project_name = Column(NVARCHAR(200),nullable=True,)
    source_opened_at = Column(DATETIME2(precision=0),nullable=False,)
    source_status = Column(NVARCHAR(50),nullable=True,)
    source_last_modified_at = Column(DATETIME2(precision=0),nullable=True,)
    original_level_1 = Column(NVARCHAR(150),nullable=True,)
    original_level_2 = Column(NVARCHAR(150),nullable=True,)
    original_level_3 = Column(NVARCHAR(200),nullable=True,)
    original_catalog_id = Column(BigInteger,ForeignKey("dbo.requirement_category_catalog.catalog_id",name="FK_rc_results_original_catalog",),nullable=True,)
    suggested_catalog_id = Column(BigInteger,ForeignKey("dbo.requirement_category_catalog.catalog_id",name="FK_rc_results_suggested_catalog",),nullable=True,)
    result_status = Column(String(10),nullable=False,)
    reason_code = Column(String(60),nullable=False,)
    reason_text = Column(NVARCHAR(2000),nullable=False,)
    evidence_json = Column(NVARCHAR(None),nullable=True,)
    semantic_score = Column(Float,nullable=True,)
    source_hash = Column(CHAR(64),nullable=False,)
    evaluated_at = Column(DATETIME2(precision=0),nullable=False,server_default=text("SYSUTCDATETIME()"),)
    source_status_reason = Column(NVARCHAR(100),nullable=True,)
    source_resolved_at = Column(DATETIME2(precision=0),nullable=True,)
    ticket_lifecycle_status = Column(String(20),nullable=True,)
    has_solution = Column(BIT,nullable=True,)
    solution_check_status = Column(String(24),nullable=True,)
    solution_check_reason = Column(NVARCHAR(500),nullable=True,)

    run = relationship("RequirementCategorizationAuditRun",back_populates="results",)

    __table_args__ = (
        PrimaryKeyConstraint(
            "result_id",
            name="PK_requirement_categorization_audit_results",
        ),

        CheckConstraint(
            "result_status IN "
            "('CORRECT', 'INCORRECT')",
            name="CK_rc_results_status",
        ),

        CheckConstraint(
            "evidence_json IS NULL "
            "OR ISJSON(evidence_json) = 1",
            name="CK_rc_results_evidence_json",
        ),

        CheckConstraint(
            "ticket_lifecycle_status IN "
            "('RESOLVED', 'CANCELLED', "
            "'OPEN', 'UNCERTAIN')",
            name="CK_rc_results_lifecycle",
        ),

        CheckConstraint(
            "solution_check_status IN "
            "('PRESENT', 'MISSING_REQUIRED', "
            "'OPTIONAL_MISSING', 'REVIEW_STATUS')",
            name="CK_rc_results_solution_check",
        ),

        Index(
            "UX_rc_results_run_ticket",
            "run_id",
            "ticket_id",
            unique=True,
        ),

        Index(
            "IX_rc_results_run_status",
            "run_id",
            "result_status",
            source_opened_at.desc(),
            mssql_include=[
                "ticket_id",
                "resolver_name",
            ],
        ),

        Index(
            "IX_rc_results_run_resolver",
            "run_id",
            "resolver_name",
            "result_status",
        ),

        {"schema": "dbo"},
    )



class RequirementCategorizationAuditGroup(Base):
    __tablename__ = "requirement_categorization_audit_groups"
    group_id = Column(BigInteger,Identity(start=1, increment=1),nullable=False,)
    group_name = Column(NVARCHAR(200),nullable=False,)
    grupo_resolutor = Column(NVARCHAR(150),nullable=False,)
    audit_year = Column(SmallInteger,nullable=False,)
    description = Column(NVARCHAR(500),nullable=True,)
    created_at = Column(DATETIME2(precision=0),nullable=False,server_default=text("SYSUTCDATETIME()"),)
    runs = relationship("RequirementCategorizationAuditRun",back_populates="audit_group",)

    __table_args__ = (
        PrimaryKeyConstraint("group_id",name="PK_rc_audit_groups",),
        UniqueConstraint("grupo_resolutor","audit_year",name="UQ_rc_groups_resolver_year",),
        CheckConstraint("audit_year BETWEEN 2000 AND 2100",name="CK_rc_groups_year",),{"schema": "dbo"},
    )
