import { Component, ElementRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = this.auth.isAdmin;
  readonly isAccountMenuOpen = signal(false);

  ngOnInit(): void {
    // currentUser isn't persisted across reloads; rehydrate it from the token
    // so the nav bar (name, admin-only links) renders correctly.
    if (!this.currentUser() && this.auth.getToken()) {
      this.auth.fetchCurrentUser().subscribe();
    }
  }

  logout(): void {
    this.closeAccountMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleAccountMenu(): void {
    this.isAccountMenuOpen.update((open) => !open);
  }

  closeAccountMenu(): void {
    this.isAccountMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (event.target instanceof Node && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeAccountMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAccountMenu();
  }
}
