import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule, MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatRadioModule } from '@angular/material/radio';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSortModule } from '@angular/material/sort';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        MatToolbarModule,
        MatButtonModule,
        MatCardModule,
        MatTableModule,
        MatFormFieldModule,
        MatIconModule,
        MatSnackBarModule,
        MatPaginatorModule,
        MatInputModule,
        MatCheckboxModule,
        MatDialogModule,
        MatOptionModule,
        MatCheckboxModule,
        MatSelectModule,
        MatDatepickerModule,
        MatRadioModule,
        MatNativeDateModule,
        MatSortModule,
    ],

    exports: [
        MatToolbarModule,
        MatButtonModule,
        MatCardModule,
        MatTableModule,
        MatFormFieldModule,
        MatIconModule,
        MatSnackBarModule,
        MatPaginatorModule,
        MatInputModule,
        MatCheckboxModule,
        MatDialogModule,
        MatOptionModule,
        MatCheckboxModule,
        MatSelectModule,
        MatDatepickerModule,
        MatRadioModule,
        MatNativeDateModule,
        MatSortModule,
    ]
})

export class MaterialModule { }