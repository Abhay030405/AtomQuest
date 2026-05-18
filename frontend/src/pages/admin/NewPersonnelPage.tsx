import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userService } from "@/services/user.service";
import { useAllUsers } from "@/hooks/useApprovals";
import { ROUTES } from "@/constants/routes";
import { UserRole } from "@/types/user.types";

interface NewPersonnelPageProps {
  role: Extract<UserRole, "employee" | "manager">;
}

export default function NewPersonnelPage({ role }: Readonly<NewPersonnelPageProps>) {
  const navigate = useNavigate();
  const { userId: adminId = "" } = useParams<{ userId: string }>();
  const qc = useQueryClient();

  const isManagerForm = role === "manager";
  const title = isManagerForm ? "Add New Manager" : "Add New Employee";

  const { data: departments = [], isLoading: deptsLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => userService.getDepartments(),
  });

  const { data: allUsers = [] } = useAllUsers();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Managers in the selected department only — empty until a department is chosen.
  const managerOptions = useMemo(() => {
    if (!departmentId) return [];
    return allUsers
      .filter((u) => u.role === "manager" && u.departmentId === departmentId && u.isActive)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [allUsers, departmentId]);

  const createMutation = useMutation({
    mutationFn: () =>
      userService.createUser({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        role,
        departmentId,
        managerId: isManagerForm ? undefined : managerId || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
      }),
    onSuccess: (user) => {
      toast.success(`${user.fullName} created successfully`);
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["direct-reports"] });
      navigate(ROUTES.ADMIN.PERSONNEL(adminId));
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to create user";
      toast.error(message);
    },
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";
    if (!phoneNumber.trim()) next.phoneNumber = "Phone number is required";
    if (!departmentId) next.departmentId = "Select a department";
    if (!isManagerForm && !managerId) next.managerId = "Select a manager";
    if (!password) next.password = "Password is required";
    else if (password.length < 8) next.password = "Minimum 8 characters";
    else if (!/[A-Z]/.test(password)) next.password = "Must include an uppercase letter";
    else if (!/[a-z]/.test(password)) next.password = "Must include a lowercase letter";
    else if (!/\d/.test(password)) next.password = "Must include a digit";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate();
  }

  const submitting = createMutation.isPending;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-2xl mx-auto w-full space-y-xl">
      {/* Header */}
      <div className="border-b border-outline-variant pb-md">
        <button
          type="button"
          onClick={() => navigate(ROUTES.ADMIN.PERSONNEL(adminId))}
          className="text-label-md text-on-surface-variant hover:text-on-surface flex items-center gap-xs mb-xs"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Personnel
        </button>
        <h2 className="text-display-lg text-on-surface mb-xs">{title}</h2>
        <p className="text-body-lg text-on-surface-variant">
          Create a new {isManagerForm ? "manager" : "employee"} account. They will be able to sign
          in immediately with the credentials below.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-lg">
        <Field label="Name" error={errors.fullName} required>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
            placeholder="e.g. Priya Sharma"
            autoComplete="off"
          />
        </Field>

        <Field label="Email ID" error={errors.email} required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
            placeholder="name@atomberg.com"
            autoComplete="off"
          />
        </Field>

        <Field label="Phone Number" error={errors.phoneNumber} required>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
            placeholder="+91-9000000000"
            autoComplete="off"
          />
        </Field>

        <Field label="Department" error={errors.departmentId} required>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setManagerId("");
            }}
            disabled={deptsLoading}
            className="w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none disabled:opacity-60"
          >
            <option value="">
              {deptsLoading ? "Loading departments…" : "Select a department"}
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

        {!isManagerForm && (
          <Field label="Manager" error={errors.managerId} required>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              disabled={!departmentId}
              className="w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none disabled:opacity-60"
            >
              <option value="">
                {!departmentId
                  ? "Select a department first"
                  : managerOptions.length === 0
                  ? "No managers in this department"
                  : "Select a manager"}
              </option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Password" error={errors.password} required>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
            placeholder="Min 8 chars — upper, lower, digit"
            autoComplete="new-password"
          />
        </Field>

        <div className="flex items-center gap-sm pt-md">
          <button
            type="submit"
            disabled={submitting}
            className="px-lg py-sm bg-primary text-on-primary rounded-lg text-label-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? "Creating…" : `Create ${isManagerForm ? "Manager" : "Employee"}`}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.ADMIN.PERSONNEL(adminId))}
            disabled={submitting}
            className="px-lg py-sm border border-outline-variant text-on-surface rounded-lg text-label-lg font-medium hover:bg-surface-container-low transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, error, required, children }: Readonly<FieldProps>) {
  return (
    <div className="space-y-1.5">
      <label className="block text-label-md text-on-surface font-medium">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-label-sm text-error">{error}</p>}
    </div>
  );
}
