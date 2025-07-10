<?php
header('Content-Type: application/json');

// Initialize response array
$response = ['success' => false, 'message' => ''];

// Validate required fields
if (empty($_POST['full-name']) || empty($_POST['email']) || empty($_POST['subject'])) {
    $response['message'] = 'Please fill in all required fields.';
    echo json_encode($response);
    exit;
}

// Sanitize input data
$fullName = filter_var($_POST['full-name'], FILTER_SANITIZE_STRING);
$email = filter_var($_POST['email'], FILTER_SANITIZE_EMAIL);
$phone = !empty($_POST['phone-number']) ? filter_var($_POST['phone-number'], FILTER_SANITIZE_STRING) : '';
$subject = filter_var($_POST['subject'], FILTER_SANITIZE_STRING);
$budget = !empty($_POST['budget']) ? filter_var($_POST['budget'], FILTER_SANITIZE_NUMBER_INT) : '';
$message = !empty($_POST['message']) ? filter_var($_POST['message'], FILTER_SANITIZE_STRING) : '';

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $response['message'] = 'Invalid email address.';
    echo json_encode($response);
    exit;
}

// Email configuration
$to = 'info@tekntandao.com'; // Replace with your email address
$emailSubject = 'New Contact Form Submission: ' . $subject;
$headers = "From: $email\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// Build email body
$body = "New Contact Form Submission\n\n";
$body .= "Full Name: $fullName\n";
$body .= "Email: $email\n";
$body .= "Phone: $phone\n";
$body .= "Subject: $subject\n";
$body .= "Budget: $budget\n";
$body .= "Message: $message\n";

// Handle file upload
$attachment = '';
if (!empty($_FILES['file']['name'])) {
    $allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    $maxSize = 5 * 1024 * 1024; // 5MB
    $fileType = $_FILES['file']['type'];
    $fileSize = $_FILES['file']['size'];
    $fileTmp = $_FILES['file']['tmp_name'];
    $fileName = basename($_FILES['file']['name']);

    if (!in_array($fileType, $allowedTypes) || $fileSize > $maxSize) {
        $response['message'] = 'Invalid file type or size. Only JPEG, PNG, or PDF files up to 5MB are allowed.';
        echo json_encode($response);
        exit;
    }

    // File upload handling (store temporarily or attach later with PHPMailer)
    $attachment = "Attachment: $fileName\n";
}

// Send email
if (mail($to, $emailSubject, $body . $attachment, $headers)) {
    $response['success'] = true;
    $response['message'] = 'Your message was sent successfully.';
} else {
    $response['message'] = 'Failed to send the message. Please try again later.';
}

// Return JSON response for AJAX
echo json_encode($response);
?>