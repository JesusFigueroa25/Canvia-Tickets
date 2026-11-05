from fastapi import FastAPI
from app.core.cors import configurar_cors

from app.controllers import (etl_test_controller, 
                             incident_sla_controller, 
                             requirement_sla_controller, 
                             incident_consolidated_controller,
                             requirement_consolidated_controller,
                             auth_controller,
                             home_controller, 
                             ai_chat_controller,
                             requirement_categorization_audit_controller
                             )
from app.database.database import Base, engine
from app.models.import_run_model import ImportRun

app = FastAPI(title="Canvia Dashboard API", version="1.0")
configurar_cors(app)
app.include_router(etl_test_controller.router)
app.include_router(incident_sla_controller.router)
app.include_router(requirement_sla_controller.router)
app.include_router(incident_consolidated_controller.router)
app.include_router(requirement_consolidated_controller.router)
app.include_router(auth_controller.router)
app.include_router(home_controller.router)
app.include_router(ai_chat_controller.router)
app.include_router(requirement_categorization_audit_controller.router)

@app.get("/")
def root():

    return {
        "mensaje": "Canvia API funcionando"
    }