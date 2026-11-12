import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('matches the dashboard brand wordmark and icon size', () => {
    fixture.detectChanges();

    const brand = fixture.nativeElement.querySelector('.auth-brand');
    expect(brand.querySelector('img').getAttribute('width')).toBe('56');
    expect(brand.querySelector('.auth-brand-accent').textContent).toBe('It');
  });

  it('shows the sign-in title and themed ClockIt subheading', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#login-title').textContent).toBe('Sign in');
    expect(fixture.nativeElement.querySelector('.auth-eyebrow').textContent).toBe(
      'Team time tracking',
    );
    expect(fixture.nativeElement.querySelector('.btn-primary').textContent.trim()).toBe('Sign in');
  });
});
