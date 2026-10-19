import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
