"""Upload worker entrypoint."""

from backend.services.upload_job_queue import run_upload_worker_loop


def main() -> None:
    run_upload_worker_loop()


if __name__ == "__main__":
    main()

