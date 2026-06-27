from simple_salesforce import Salesforce
from tenacity import retry, stop_after_attempt, wait_exponential
import structlog

from config import settings

log = structlog.get_logger()


class SalesforceClient:
    def __init__(self):
        self.sf = Salesforce(
            username=settings.sf_username,
            password=settings.sf_password,
            security_token=settings.sf_security_token,
            domain=settings.sf_domain,
        )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def query(self, soql: str) -> list[dict]:
        result = self.sf.query_all(soql)
        return result.get("records", [])

    def get_historical_cases(self, limit: int = 5000) -> list[dict]:
        soql = f"""
            SELECT Id, CaseNumber, Subject, Description, Status, Type,
                   Priority, Origin, ClosedDate, CreatedDate,
                   Contact.Name, Contact.Email, Owner.Name
            FROM Case
            ORDER BY ClosedDate DESC
            LIMIT {limit}
        """
        cases = self.query(soql)
        log.info("fetched_historical_cases", count=len(cases))

        for case in cases:
            case_id = case["Id"]
            case["Comments"] = self._safe_query(self._get_comments, case_id)
            case["Emails"] = self._safe_query(self._get_emails, case_id)
            case["FeedItems"] = self._safe_query(self._get_feed_items, case_id)

        return cases

    def get_case_by_id(self, case_id: str) -> dict:
        soql = f"""
            SELECT Id, CaseNumber, Subject, Description, Status, Type,
                   Priority, Origin, CreatedDate,
                   Contact.Name, Contact.Email, Owner.Name
            FROM Case
            WHERE Id = '{case_id}'
        """
        cases = self.query(soql)
        if not cases:
            raise ValueError(f"Case not found: {case_id}")

        case = cases[0]
        case["Comments"] = self._safe_query(self._get_comments, case_id)
        case["Emails"] = self._safe_query(self._get_emails, case_id)
        case["FeedItems"] = self._safe_query(self._get_feed_items, case_id)
        return case

    def update_case(self, case_id: str, data: dict):
        self.sf.Case.update(case_id, data)
        log.info("case_updated", case_id=case_id, fields=list(data.keys()))

    def _safe_query(self, fn, case_id: str) -> list[dict]:
        try:
            return fn(case_id)
        except Exception as e:
            log.warning("sub_query_failed", case_id=case_id, fn=fn.__name__, error=str(e))
            return []

    def _get_comments(self, case_id: str) -> list[dict]:
        soql = f"""
            SELECT CommentBody, CreatedDate, CreatedBy.Name
            FROM CaseComment
            WHERE ParentId = '{case_id}'
            ORDER BY CreatedDate ASC
        """
        return self.query(soql)

    def _get_emails(self, case_id: str) -> list[dict]:
        soql = f"""
            SELECT Subject, TextBody, FromAddress, ToAddress, CreatedDate
            FROM EmailMessage
            WHERE ParentId = '{case_id}'
            ORDER BY CreatedDate ASC
        """
        return self.query(soql)

    def _get_feed_items(self, case_id: str) -> list[dict]:
        soql = f"""
            SELECT Body, CreatedDate, CreatedBy.Name
            FROM FeedItem
            WHERE ParentId = '{case_id}' AND Body != null
            ORDER BY CreatedDate ASC
        """
        return self.query(soql)
