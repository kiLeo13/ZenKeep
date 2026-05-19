import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MultiSelectMenu } from "./MultiSelectMenu"

class ResizeObserverMock {
  observe(): void {
    // jsdom test shim
  }
  unobserve(): void {
    // jsdom test shim
  }
  disconnect(): void {
    // jsdom test shim
  }
}

globalThis.ResizeObserver = ResizeObserverMock

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "menus.users.perms.saveButton") return "Save"
      return key
    }
  })
}))

describe("MultiSelectMenu", () => {
  it("supports deferred changes with an explicit save action", async () => {
    const onChange = vi.fn()
    const onSave = vi.fn()

    render(
      <MultiSelectMenu
        label="Permissions"
        options={[{ id: 1, label: "Edit notes" }]}
        values={[]}
        onChange={onChange}
        onSave={onSave}
      />
    )

    fireEvent.pointerDown(screen.getByRole("button", { name: /permissions/i }))
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /edit notes/i }))

    expect(onChange).toHaveBeenCalledWith([1])

    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("supports immediate async item toggles without a save footer", async () => {
    let resolveToggle!: () => void
    const onItemToggle = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveToggle = resolve
        })
    )

    render(
      <MultiSelectMenu
        label="Departments"
        options={[{ id: "dept-a", label: "Support" }]}
        values={[]}
        onItemToggle={onItemToggle}
        showFooter={false}
      />
    )

    fireEvent.pointerDown(screen.getByRole("button", { name: /departments/i }))
    const item = await screen.findByRole("menuitemcheckbox", { name: /support/i })

    fireEvent.click(item)

    expect(onItemToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "dept-a" }),
      true,
      ["dept-a"]
    )
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument()
    expect(item).toHaveAttribute("data-disabled")

    resolveToggle()

    await waitFor(() => {
      expect(item).not.toHaveAttribute("data-disabled")
    })
  })
})
