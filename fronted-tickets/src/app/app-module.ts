import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MaterialModule } from './material/material-module';
import { Home } from './components/pages/home/home';
import { Login } from './components/pages/login/login';
import { Sidenav } from './components/sidenav/sidenav';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Landing } from './components/pages/landing/landing';
import { Body } from './components/layouts/body/body';
import { IncidentSla } from './components/pages/incident-sla/incident-sla';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { KpiCard } from './components/kpi-card/kpi-card';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ProjectExplorerTable } from './components/charts/project-explorer-table/project-explorer-table';
import { ResolverPerformance } from './components/charts/SLA/resolver-performance/resolver-performance';
import { RequirementSla } from './components/pages/requirement-sla/requirement-sla';
import { RequirementSlaSolutionTrend } from './components/charts/SLA/requirement-sla-solution-trend/requirement-sla-solution-trend';
import { ProjectParticipation } from './components/charts/SLA/project-participation/project-participation';
import { HomeExecutiveSummary } from './components/charts/Home/home-executive-summary/home-executive-summary';
import { IncidentConsolidated } from './components/pages/incident-consolidated/incident-consolidated';
import { CategoryDistribution } from './components/charts/Consolidated/category-distribution/category-distribution';
import { ProjectMonthlyTop } from './components/charts/Consolidated/project-monthly-top/project-monthly-top';
import { PriorityMonthlyStack } from './components/charts/Consolidated/priority-monthly-stack/priority-monthly-stack';
import { RequirementConsolidated } from './components/pages/requirement-consolidated/requirement-consolidated';
import { CommonModule } from '@angular/common';
import { VolumeMonth } from './components/charts/volume-month/volume-month';
import { ResolverPerformanceTable } from './components/charts/Consolidated/resolver-performance-table/resolver-performance-table';
import { DescriptionMonthExplorer } from './components/charts/Consolidated/description-month-explorer/description-month-explorer';
import { TechnicalEventsTable } from './components/charts/Consolidated/technical-events-table/technical-events-table';
import { IncidentPercentageBars } from './components/charts/Consolidated/incident-percentage-bars/incident-percentage-bars';
import { TopDescriptionProject } from './components/charts/Consolidated/top-description-project/top-description-project';
import { TopTechnicalDetails } from './components/charts/Consolidated/top-technical-details/top-technical-details';
import { ResolverMonthlyTickets } from './components/charts/Consolidated/resolver-monthly-tickets/resolver-monthly-tickets';
import { RequirementSlaTypeExplorer } from './components/charts/SLA/requirement-sla-type-explorer/requirement-sla-type-explorer';
import { RequirementSlaComplianceDonut } from './components/charts/SLA/requirement-sla-compliance-donut/requirement-sla-compliance-donut';
import { RequirementSlaHourlyCompliance } from './components/charts/SLA/requirement-sla-hourly-compliance/requirement-sla-hourly-compliance';
import { RequirementSlaPriorityCompliance } from './components/charts/SLA/requirement-sla-priority-compliance/requirement-sla-priority-compliance';
import { RequirementSlaTopCategories } from './components/charts/SLA/requirement-sla-top-categories/requirement-sla-top-categories';
import { RequirementSlaTypeCompliance } from './components/charts/SLA/requirement-sla-type-compliance/requirement-sla-type-compliance';
import { RequirementSlaParetoTable } from './components/charts/SLA/requirement-sla-pareto-table/requirement-sla-pareto-table';
import { RequirementSlaParetoChart } from './components/charts/SLA/requirement-sla-pareto-chart/requirement-sla-pareto-chart';
import { ImportacionCardComponent } from './components/pages/importaciones/importacion-card/importacion-card.component';
import { ImportacionesComponent } from './components/pages/importaciones/importaciones.component';
import { TendenciaTypeTrend } from './components/charts/SLA/incident-type-trend/incident-type-trend';
import { SlaSolutionTrend } from './components/charts/SLA/sla-solution-trend/sla-solution-trend';
import { SLAPareto } from './components/charts/SLA/sla-pareto/sla-pareto';
import { HomeMonthlyVolume } from './components/charts/Home/home-monthly-volume/home-monthly-volume';
import { HomeSlaEvolution } from './components/charts/Home/home-sla-evolution/home-sla-evolution';
import { AiChat } from './components/pages/ai-chat/ai-chat';
import { AiChatSidebar } from './components/pages/ai-chat/ai-chat-sidebar/ai-chat-sidebar';
import { AiChatMessages } from './components/pages/ai-chat/ai-chat-messages/ai-chat-messages';
import { AiChatComposer } from './components/pages/ai-chat/ai-chat-composer/ai-chat-composer';
import { RequirementCategorizationAudit } from './components/pages/requirement-categorization-audit/requirement-categorization-audit';
import { RequirementCategorizationDistribution } from './components/charts/Categorization/requirement-categorization-distribution/requirement-categorization-distribution';
import { RequirementCategorizationResolvers } from './components/charts/Categorization/requirement-categorization-resolvers/requirement-categorization-resolvers';
import { RequirementCategorizationSolutions } from './components/charts/Categorization/requirement-categorization-solutions/requirement-categorization-solutions';
import { RequirementCategorizationTicketsTable } from './components/charts/Categorization/requirement-categorization-tickets-table/requirement-categorization-tickets-table';
import { RequirementCategorizationResolversTable } from './components/charts/Categorization/requirement-categorization-resolvers-table/requirement-categorization-resolvers-table';
import { RequirementCategorizationMonthlyChart } from './components/charts/Categorization/requirement-categorization-monthly-chart/requirement-categorization-monthly-chart';
import { RequirementCategorizationMonthlyTable } from './components/charts/Categorization/requirement-categorization-monthly-table/requirement-categorization-monthly-table';
import { TicketExplorerTable } from './components/charts/ticket-explorer-table/ticket-explorer-table';

@NgModule({
  declarations: [
    App,
    Home,
    Login,
    Sidenav,
    Landing,
    Body,
    IncidentSla,
    KpiCard,
    SlaSolutionTrend,
    VolumeMonth,
    ProjectExplorerTable,
    SLAPareto,
    TendenciaTypeTrend,
    ResolverPerformance,
    RequirementSla,
    RequirementSlaSolutionTrend,
    ProjectParticipation,
    HomeMonthlyVolume,
    HomeSlaEvolution,
    HomeExecutiveSummary,
    IncidentConsolidated,
    CategoryDistribution,
    ProjectMonthlyTop,
    PriorityMonthlyStack,
    RequirementConsolidated,
    ResolverPerformanceTable,
    DescriptionMonthExplorer,
    TechnicalEventsTable,
    IncidentPercentageBars,
    TopDescriptionProject,
    TopTechnicalDetails,
    ResolverMonthlyTickets,
    RequirementSlaTypeExplorer,
    RequirementSlaComplianceDonut,
    RequirementSlaHourlyCompliance,
    RequirementSlaPriorityCompliance,
    RequirementSlaTopCategories,
    RequirementSlaTypeCompliance,
    RequirementSlaParetoTable,
    RequirementSlaParetoChart,
    ImportacionCardComponent,
    ImportacionesComponent,
    AiChat,
    AiChatSidebar,
    AiChatMessages,
    AiChatComposer,
    RequirementCategorizationAudit,
    RequirementCategorizationDistribution,
    RequirementCategorizationResolvers,
    RequirementCategorizationSolutions,
    RequirementCategorizationTicketsTable,
    RequirementCategorizationResolversTable,
    RequirementCategorizationMonthlyChart,
    RequirementCategorizationMonthlyTable,
    TicketExplorerTable,
  ],
  imports: [
    BrowserAnimationsModule,
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    RouterModule,
    BaseChartDirective,
    CommonModule,
    MaterialModule,
    AppRoutingModule,
  ],

  providers: [
    provideClientHydration(),
    provideAnimationsAsync(),
    provideBrowserGlobalErrorListeners(),
    {
      provide: MAT_DATE_LOCALE,
      useValue: 'es-PE',
    },
    provideCharts(withDefaultRegisterables()),
  ],
  bootstrap: [App],
})
export class AppModule {}
