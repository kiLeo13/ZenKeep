import { useMemo, useState, type JSX } from "react"

import clsx from "clsx"

import { IoMdClose } from "react-icons/io"
import { MdDownload, MdPictureAsPdf } from "react-icons/md"
import { Button } from "@/components/ui/buttons/Button"
import { BaseModalTextInput } from "../../notes/shared/inputs/BaseModalTextInput"
import { ModalLabel } from "../../notes/shared/sections/ModalLabel"
import { miscService } from "@/services/miscService"
import { useTranslation } from "react-i18next"
import { formatNumber } from "@/utils/utils"
import { toasts } from "@/utils/toastUtils"

import styles from "./TextPDFModal.module.css"

const MAX_FILE_NAME_LENGTH = 120
const MAX_CONTENT_LENGTH = 100000
const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g

type TextPDFModalProps = {
  onClose: () => void
}

export function TextPDFModal({ onClose }: TextPDFModalProps): JSX.Element {
  const { t } = useTranslation()

  const [fileName, setFileName] = useState("")
  const [content, setContent] = useState("")
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fileNameError = useMemo(() => {
    if (fileName.length > MAX_FILE_NAME_LENGTH) {
      return t("errors.string.max", { count: MAX_FILE_NAME_LENGTH })
    }

    if (hasAttemptedSubmit && fileName.trim().length === 0) {
      return t("errors.required")
    }

    return ""
  }, [fileName, hasAttemptedSubmit, t])

  const contentError = useMemo(() => {
    if (content.length > MAX_CONTENT_LENGTH) {
      return t("errors.string.max", { count: MAX_CONTENT_LENGTH })
    }

    if (hasAttemptedSubmit && content.trim().length === 0) {
      return t("errors.required")
    }

    return ""
  }, [content, hasAttemptedSubmit, t])

  const canDownload =
    !isLoading &&
    fileName.trim().length > 0 &&
    content.trim().length > 0 &&
    !fileNameError &&
    !contentError

  const handleDownload = async () => {
    setHasAttemptedSubmit(true)

    if (!canDownload) {
      return
    }

    setIsLoading(true)
    const response = await miscService.generateTextPDF({ fileName, content })
    setIsLoading(false)

    if (!response.success) {
      toasts.apiError(t("modals.textPdf.toasts.error"), response)
      return
    }

    triggerFileDownload(response.data, ensurePDFFileName(fileName))
  }

  return (
    <section className={styles.container} aria-labelledby="text-pdf-title">
      <button
        type="button"
        className={styles.close}
        aria-label={t("commons.cancel")}
        onClick={onClose}
      >
        <IoMdClose size={"1.35em"} />
      </button>

      <header className={styles.header}>
        <div className={styles.titleIcon}>
          <MdPictureAsPdf size={"1.2em"} />
        </div>
        <div className={styles.titleCopy}>
          <h2 id="text-pdf-title" className={styles.title}>
            {t("modals.textPdf.title")}
          </h2>
          <p className={styles.subtitle}>{t("modals.textPdf.subtitle")}</p>
        </div>
      </header>

      <div className={styles.form}>
        <div className={styles.field}>
          <ModalLabel
            title={t("modals.textPdf.fileName")}
            htmlFor="text-pdf-file-name"
            required
          />
          <BaseModalTextInput
            id="text-pdf-file-name"
            value={fileName}
            maxLength={MAX_FILE_NAME_LENGTH + 8}
            placeholder={t("modals.textPdf.fileNamePlaceholder")}
            errorMessage={fileNameError}
            onChange={(event) => setFileName(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <ModalLabel
            title={t("modals.textPdf.content")}
            htmlFor="text-pdf-content"
            required
          />
          <div className={styles.textAreaWrapper}>
            <textarea
              id="text-pdf-content"
              className={clsx(styles.textArea, contentError && styles.invalid)}
              value={content}
              maxLength={MAX_CONTENT_LENGTH + 1}
              placeholder={t("modals.textPdf.contentPlaceholder")}
              onChange={(event) => setContent(event.target.value)}
            />
            <div className={styles.metaRow}>
              {contentError ? (
                <span className={styles.errorMessage}>{contentError}</span>
              ) : (
                <span>{t("modals.textPdf.contentHint")}</span>
              )}
              <span>
                {formatNumber(content.length)}/
                {formatNumber(MAX_CONTENT_LENGTH)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.actions}>
        <Button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
          disabled={isLoading}
        >
          {t("commons.cancel")}
        </Button>
        <Button
          type="button"
          className={styles.primaryButton}
          isLoading={isLoading}
          loaderProps={{ scale: "0.8" }}
          disabled={!canDownload}
          onClick={() => void handleDownload()}
        >
          <MdDownload size={"1.15em"} />
          {t("modals.textPdf.download")}
        </Button>
      </footer>
    </section>
  )
}

function triggerFileDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = objectUrl
  link.download = fileName
  link.rel = "noopener"

  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function ensurePDFFileName(fileName: string): string {
  const sanitized = Array.from(
    fileName.trim().replace(INVALID_FILE_NAME_CHARS, "_"),
    (char) => (char.charCodeAt(0) < 32 ? "_" : char)
  ).join("")

  const normalized = sanitized.replace(/[. ]+$/g, "") || "document"
  if (normalized.toLowerCase().endsWith(".pdf")) {
    return normalized
  }
  return `${normalized}.pdf`
}
