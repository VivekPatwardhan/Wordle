import { Component, inject } from '@angular/core';
import { ModalService } from '../../services/modal-service';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class ModalComponent {
  readonly modalService = inject(ModalService);
}