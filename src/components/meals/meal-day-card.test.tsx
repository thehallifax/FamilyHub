import { vi } from "vitest";
import { formatLocalDate } from "@/lib/time-utils";
import { createEmptyMealsBoard } from "@/test/fixtures/meals";
import { render, renderWithUser, screen } from "@/test/test-utils";
import { MealDayCard } from "./meal-day-card";

const dayWith = (date: string, dayIndex = 0) => ({ date, dayIndex, slots: [] });

describe("MealDayCard today affordance", () => {
  it("marks today with aria-current", () => {
    render(
      <MealDayCard
        day={dayWith(formatLocalDate(new Date()))}
        readOnly={false}
        onSelectSlot={() => {}}
      />,
    );
    expect(screen.getByRole("region")).toHaveAttribute("aria-current", "date");
  });

  it("does not mark a non-today day", () => {
    render(
      <MealDayCard
        day={dayWith("2020-01-02")}
        readOnly={false}
        onSelectSlot={() => {}}
      />,
    );
    expect(screen.getByRole("region")).not.toHaveAttribute("aria-current");
  });
});

describe("MealDayCard compact layout", () => {
  it("collapses an empty day into one add action with an explicit meal-type choice", async () => {
    const day = createEmptyMealsBoard().days[0];
    const onSelectSlot = vi.fn();
    const { user } = renderWithUser(
      <MealDayCard day={day} readOnly={false} onSelectSlot={onSelectSlot} />,
    );

    expect(screen.getByText("No meals planned")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add breakfast meal/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Add meal, Sunday, Jun 7" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Add meal to Sunday, Jun 7",
    });
    expect(dialog).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Add lunch, Sunday, Jun 7" }),
    );

    expect(onSelectSlot).toHaveBeenCalledWith(day.slots[1]);
    expect(dialog).not.toBeInTheDocument();
  });

  it("shows populated slots without rendering large placeholders for empty slots", () => {
    const day = createEmptyMealsBoard().days[0];
    day.slots[2] = {
      ...day.slots[2],
      id: "sunday-dinner",
      primary: {
        id: "sunday-dinner-primary",
        role: "primary",
        sourceType: "quick",
        recipeId: null,
        title: "A deliberately long family dinner name that needs to wrap",
        imageUrl: null,
        note: null,
      },
    };

    render(<MealDayCard day={day} readOnly={false} onSelectSlot={() => {}} />);

    expect(
      screen.getByRole("button", {
        name: /open dinner: a deliberately long family dinner name/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "A deliberately long family dinner name that needs to wrap",
      ),
    ).toHaveClass("line-clamp-2", "break-words");
    expect(screen.queryByText("No meals planned")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add breakfast meal/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add meal, Sunday, Jun 7" }),
    ).toBeInTheDocument();
  });

  it("keeps past empty days compact and non-editable", () => {
    const day = createEmptyMealsBoard().days[0];

    render(<MealDayCard day={day} readOnly={true} onSelectSlot={() => {}} />);

    expect(screen.getByText("No meals planned")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add meal/i }),
    ).not.toBeInTheDocument();
  });
});
