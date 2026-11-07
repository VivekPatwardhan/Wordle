import { Component, inject } from '@angular/core';
import { ModalService } from '../../../services/modal-service';
import { WordDefinitionCard } from '../word-definition/word-definition';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [WordDefinitionCard],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class ModalComponent {
  readonly modalService = inject(ModalService);
}
