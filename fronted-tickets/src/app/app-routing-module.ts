import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Landing } from './components/pages/landing/landing';
import { Login } from './components/pages/login/login';
import { Body } from './components/layouts/body/body';
import { authGuard, guestGuard } from './core/auth.guard';
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
import { ChangeConsolidated } from './components/pages/change-consolidated/change-consolidated';
import { TicketsParallelAnalysis } from './components/pages/tickets-parallel-analysis/tickets-parallel-analysis';

const routes: Routes = [

  // RUTAS PÚBLICAS
  { path: '', component: Landing, pathMatch: 'full', canActivate: [guestGuard] },
  { path: 'login', component: Login, canActivate: [guestGuard] },

  // RUTAS PROTEGIDAS
  {
    path: '',
    component: Body,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: 'home', component: Home },
      { path: 'incidentes-sla', component: IncidentSla },
      { path: 'requerimientos-sla', component: RequirementSla },
      { path: 'incidentes-consolidados', component: IncidentConsolidated },
      { path: 'requerimientos-consolidados', component: RequirementConsolidated },
      { path: 'importaciones', component: ImportacionesComponent },
      { path: 'centro-ia', component: AiChat },
      { path: 'category', component: RequirementCategorizationAudit },
      { path: 'incident-cause-analysis', component: IncidentCauseAnalysis },
      { path: 'report-diary', component: DailyReport },
      { path: 'tareas-consolidados', component: TaskConsolidated },
      { path: 'tickets-report-times', component: TicketsReportTimes },
      { path: 'cambios-consolidados', component: ChangeConsolidated },
      { path: 'tickets-parallel-analysis', component: TicketsParallelAnalysis }
    ]
  },

  // RUTAS NO EXISTENTES
  { path: '**', redirectTo: '' }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }