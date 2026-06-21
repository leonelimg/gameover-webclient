# Implement Ticket Search in Sales Screen

Add a search button in the `SalesScreen` top bar to allow users to search for a previously saved ticket by its code. If found, the lines from that ticket will be loaded into the current sale.

## User Review Required

> [!NOTE]
> The search functionality assumes that the `ticketsRepository.getTicket(id)` method can accept the ticket **code** (e.g., "TK-1234") as an identifier, or that the backend supports fetching a ticket by its code via this endpoint. If the backend only supports UUIDs, we might need a separate endpoint for code-based search.

## Proposed Changes

### Sales Feature (feature-sales)

#### [SalesUiState.kt](file:///C:/Users/leone/vsc-projects/gameover/gameover-webclient/android-native/feature-sales/src/main/java/com/gameover/android/feature/sales/presentation/SalesUiState.kt)

- Add new state variables for the search dialog and searching status.
```kotlin
    val searchDialog: Boolean = false,
    val searchTicketCode: String = "",
    val isSearchingTicket: Boolean = false,
    val searchError: String? = null,
```

#### [SalesViewModel.kt](file:///C:/Users/leone/vsc-projects/gameover/gameover-webclient/android-native/feature-sales/src/main/java/com/gameover/android/feature/sales/presentation/SalesViewModel.kt)

- Add `showSearchDialog()`, `hideSearchDialog()`, and `onSearchTicketCodeChanged()`.
- Add `searchAndLoadTicket()` to fetch a ticket by code and map its lines to `SaleLine` objects.
- Automatically select the ticket's draw if it's found in the list of open draws.

#### [SalesScreen.kt](file:///C:/Users/leone/vsc-projects/gameover/gameover-webclient/android-native/feature-sales/src/main/java/com/gameover/android/feature/sales/presentation/SalesScreen.kt)

- Add `IconButton` with `Icons.Default.Search` in the `TopAppBar` actions.
- Implement the `AlertDialog` for searching, containing a `GoTextField` for the ticket code and a "Cargar" button.

---

## Verification Plan

### Automated Tests
- I will verify if there are any existing tests for `SalesViewModel` and add a new test case for loading ticket lines if possible.
- Command: `./gradlew :feature-sales:testDebugUnitTest`

### Manual Verification
- Deploy the app and navigate to the "Ventas" screen.
- Verify the new search icon appears in the top bar.
- Click the search icon and enter a known ticket code.
- Confirm that the lines are correctly loaded into the sale form.
- Verify that the total is updated accordingly.
- Test with an invalid ticket code and verify the error message appears.
