import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Users } from './users';

describe('Users', () => {
  let component: Users;
  let fixture: ComponentFixture<Users>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Users],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Users);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads and lists users', () => {
    httpMock.expectOne((request) => request.url.endsWith('/users')).flush({
      users: [
        { id: 'u1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' },
        { id: 'u2', name: 'Uma User', email: 'uma@example.com', role: 'user' },
      ],
    });
    fixture.detectChanges();

    expect(component.users().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Ada Admin');
    expect(fixture.nativeElement.textContent).toContain('Uma User');
  });

  it('creates a new user and adds it to the list', () => {
    httpMock.expectOne((request) => request.url.endsWith('/users')).flush({ users: [] });

    component.newName.set('New Person');
    component.newEmail.set('new@example.com');
    component.newPassword.set('longenough');
    component.createUser();

    httpMock
      .expectOne((request) => request.method === 'POST' && request.url.endsWith('/users'))
      .flush({ user: { id: 'u3', name: 'New Person', email: 'new@example.com', role: 'user' } });

    expect(component.users().some((u) => u.id === 'u3')).toBe(true);
    expect(component.newName()).toBe('');
  });

  it('shows an error without calling the API when required fields are missing', () => {
    httpMock.expectOne((request) => request.url.endsWith('/users')).flush({ users: [] });

    component.createUser();

    httpMock.expectNone((request) => request.method === 'POST');
    expect(component.createError()).toContain('required');
  });
});
