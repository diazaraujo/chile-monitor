import type {
  ManagementArea,
  ManagementView,
} from "@/types/independencia-management";
export const MANAGEMENT_VIEWS: Record<
  ManagementView,
  { label: string; headline: string; description: string }
> = {
  alcaldia: {
    label: "Alcaldía",
    headline: "Decidir dónde actuar.",
    description:
      "Necesidades, recursos y decisiones que requieren coordinación. Cada cifra conserva su período.",
  },
  concejo: {
    label: "Concejo",
    headline: "Seguir el recurso hasta el resultado.",
    description:
      "Presupuesto, compras y acuerdos con evidencia. Revisiones propuestas; no observaciones certificadas ni tareas asignadas.",
  },
  direccion: {
    label: "Dirección",
    headline: "Entender la capacidad del servicio.",
    description:
      "Base disponible, registros que faltan y próximo paso por área. La disponibilidad del turno requiere validación operativa.",
  },
};
export const SECTOR_PLAN: Record<
  ManagementArea,
  {
    title: string;
    questions: Record<ManagementView, string>;
    missing: string[];
    nextStep: string;
    owner: string;
    issue: string;
    options: { title: string; evidence: string }[];
  }
> = {
  seguridad: {
    title: "Seguridad",
    questions: {
      alcaldia: "¿Qué cobertura podemos recuperar con los recursos existentes?",
      concejo: "¿Las compras se traducen en activos operativos?",
      direccion: "¿Con qué equipos y cobertura cuenta el turno?",
    },
    missing: [
      "Solicitudes 1469 y marcas de contestación, despacho y llegada",
      "Dotación y vehículos disponibles por turno",
      "Estado verificado de cámaras y mantenimiento",
    ],
    nextStep:
      "Conciliar inventario, recepción de compras y prueba de funcionamiento por activo.",
    owner: "Seguridad Pública y unidad de mantenimiento",
    issue: "seguridad_camaras",
    options: [
      {
        title: "Recuperar capacidad existente",
        evidence:
          "Verificar fallas, obligación del proveedor, repuestos y plazo antes de estimar recuperación.",
      },
      {
        title: "Revisar cobertura del turno",
        evidence:
          "Requiere demanda reciente por sector y dotación disponible; no se puede dimensionar con el inventario anual.",
      },
    ],
  },
  salud: {
    title: "Salud",
    questions: {
      alcaldia: "¿Qué limita la continuidad de atención en cada centro?",
      concejo: "¿Cómo se relacionan el gasto y los servicios prestados?",
      direccion:
        "¿La brecha está en agenda, personal, insumos o infraestructura?",
    },
    missing: [
      "Agenda y capacidad por establecimiento y prestación",
      "Stock utilizable, consumo y entregas de medicamentos",
      "Visitas domiciliarias y motivos de postergación",
    ],
    nextStep:
      "Seleccionar un centro y conciliar capacidad de atención, agenda e insumos del mismo período.",
    owner: "Salud y abastecimiento",
    issue: "medicamentos",
    options: [
      {
        title: "Recuperar horas de atención",
        evidence:
          "Separar falta de profesional, cancelación, ausentismo y capacidad de agenda; validar con la dirección de salud.",
      },
      {
        title: "Asegurar continuidad de suministros",
        evidence:
          "Cruzar stock utilizable con consumo y entregas. Una compra recibida no acredita existencias actuales.",
      },
    ],
  },
  educacion: {
    title: "Educación",
    questions: {
      alcaldia: "¿Qué necesitamos para sostener clases y asistencia?",
      concejo: "¿Qué recursos corresponden a la educación municipal?",
      direccion: "¿Qué clases, reemplazos o apoyos requieren atención?",
    },
    missing: [
      "Asistencia reciente y cobertura del reporte por RBD",
      "Horas de clases sin cobertura y reemplazos",
      "Interrupciones y seguimiento de apoyos por establecimiento",
    ],
    nextStep:
      "Validar establecimientos de administración municipal e incorporar un reporte reciente de continuidad de clases.",
    owner: "DAEM y dirección del establecimiento",
    issue: "educacion",
    options: [
      {
        title: "Resolver interrupciones de clases",
        evidence:
          "Verificar horas sin reemplazo, fallas de infraestructura y obligaciones de contratos asociados.",
      },
      {
        title: "Revisar barreras de asistencia",
        evidence:
          "Requiere asistencia reciente y seguimiento del apoyo; no extrapolar la tasa anual a estudiantes individuales.",
      },
    ],
  },
};
