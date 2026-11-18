import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Sidenav } from './components/sidenav/sidenav';
import { Landing } from './components/pages/landing/landing';
import { Login } from './components/pages/login/login';
import { Home } from './components/pages/home/home';
import { IncidentSla } from './components/pages/incident-sla/incident-sla';
import { RequirementSla } from './components/pages/requirement-sla/requirement-sla';
import { IncidentConsolidated } from './components/pages/incident-consolidated/incident-consolidated';
import { RequirementConsolidated } from './components/pages/requirement-consolidated/requirement-consolidated';
import { ImportacionesComponent } from './components/pages/importaciones/importaciones.component';
import { AiChat } from './components/pages/ai-chat/ai-chat';
import { RequirementCategorizationAudit } from './components/pages/requirement-categorization-audit/requirement-categorization-audit';
import { IncidentCauseAnalysis } from './components/pages/incident-cause-analysis/incident-cause-analysis';
import { DailyReport } from './components/pages/daily-report/daily-report';
import { TaskConsolidated } from './components/pages/task-consolidated/task-consolidated';
import { TicketsReportTimes } from './components/pages/tickets-report-times/tickets-report-times';

const routes: Routes = [
  { path: "", component: Landing },
  { path: "login", component: Login },
  { path: "home", component: Home },
  { path: "incidentes-sla", component: IncidentSla },
  { path: "requerimientos-sla", component: RequirementSla },
  { path: "incidentes-consolidados", component: IncidentConsolidated },
  { path: "requerimientos-consolidados", component: RequirementConsolidated },
  { path: "importaciones", component: ImportacionesComponent },
  { path: "centro-ia", component: AiChat },
  { path: "category", component: RequirementCategorizationAudit },
  { path: "incident-cause-analysis", component: IncidentCauseAnalysis },
  { path: "report-diary", component: DailyReport },
  { path: "tareas-consolidados", component: TaskConsolidated },
  { path: "tickets-report-times", component: TicketsReportTimes },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
